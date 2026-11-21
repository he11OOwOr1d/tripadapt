"""Permanent erasure of trips the traveler deleted, once the recovery window has passed.

`DELETE /trips/{id}` only hides a trip (`trip.deleted_at`). This removes its rows for good, after
`settings.trip_retention_days` (30 by default). It is destructive, so it is deliberately narrow:

* A trip is erased only if it is marked deleted AND was deleted more than the retention period ago. A trip that was
  never deleted can never be erased, however old.
* Each trip is erased in its own transaction, so a failure leaves that trip whole and the others unaffected.
* Rows are removed children first. A trip and its versions point at each other, so those pointers are cleared first.
* Shared place snapshots and users belong to no single trip and are never erased here.
* The report and the log carry counts and ids only, never titles, notes or any other content.

A test compares `OWNED_TABLES` with the live schema, so a new table that points at a trip cannot be forgotten.
Run by hand with `python -m app.jobs.purge` (a dry run) or `python -m app.jobs.purge --execute`.
"""

import argparse
import logging
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.persistence.database import engine
from app.persistence.models import (
    Activity,
    ConversationTurn,
    CostItem,
    CreateReceipt,
    DestinationStop,
    PlanningJob,
    PlanProposal,
    PlanVersion,
    Trip,
)

logger = logging.getLogger(__name__)

# Every table that belongs to a trip, other than `trip` itself. Stops, activities and costs go with their version
# (ON DELETE CASCADE); the rest are removed by hand, in an order that satisfies the foreign keys.
OWNED_TABLES = (
    "conversation_turn",
    "planning_job",
    "plan_proposal",
    "trip_create_receipt",
    "destination_stop",
    "activity",
    "cost_item",
    "plan_version",
)
MIN_RETENTION_DAYS = 1


@dataclass
class Erasure:
    trip_id: UUID
    # Rows removed (or, in a dry run, that would be removed), per table.
    rows: dict[str, int] = field(default_factory=dict)
    erased: bool = False
    # The kind of error only, never its message, which could carry data.
    error: str | None = None


def retention_cutoff(now: datetime, retention_days: int) -> datetime:
    """Trips deleted before this moment are due for erasure. Refuses a window shorter than a day."""
    if retention_days < MIN_RETENTION_DAYS:
        raise ValueError("The recovery window must be at least one day.")
    return now - timedelta(days=retention_days)


def _count(db: Session, model, column, ids) -> int:
    return db.scalar(select(func.count()).select_from(model).where(column.in_(ids))) or 0


def _remove_conversation(db: Session, trip_id: UUID) -> int:
    return db.execute(delete(ConversationTurn).where(ConversationTurn.trip_id == trip_id)).rowcount


def _remove_jobs(db: Session, trip_id: UUID) -> int:
    return db.execute(delete(PlanningJob).where(PlanningJob.trip_id == trip_id)).rowcount


def _remove_proposals(db: Session, trip_id: UUID) -> int:
    return db.execute(delete(PlanProposal).where(PlanProposal.trip_id == trip_id)).rowcount


def _remove_receipts(db: Session, trip_id: UUID) -> int:
    return db.execute(delete(CreateReceipt).where(CreateReceipt.trip_id == trip_id)).rowcount


def _remove_versions(db: Session, trip: Trip) -> int:
    # The trip points at its current and draft versions: clear those pointers first. The versions point at each other
    # (parent), but removing them all in one statement is fine, since that kind of key is checked when the statement ends.
    db.execute(update(Trip).where(Trip.id == trip.id).values(current_version_id=None, draft_version_id=None))
    return db.execute(delete(PlanVersion).where(PlanVersion.trip_id == trip.id)).rowcount


def _declare_erasure(db: Session, trip_id: UUID | None) -> None:
    """Tell the database this transaction is erasing exactly this trip, which lets it delete the trip's accepted plans
    (the guard `guard_plan_snapshot` allows a DELETE, and only for the declared trip). Cleared again straight afterwards."""
    db.execute(select(func.set_config("app.erasing_trip", str(trip_id) if trip_id else "", True)))


def _remove_trip_row(db: Session, trip: Trip) -> int:
    return db.execute(delete(Trip).where(Trip.id == trip.id)).rowcount


def _due(db: Session, trip_id: UUID, cutoff: datetime) -> Trip | None:
    """The trip, locked, only if it is still deleted and past the window. A trip another process holds is left for later."""
    return db.scalar(
        select(Trip)
        .where(Trip.id == trip_id, Trip.deleted_at.is_not(None), Trip.deleted_at < cutoff)
        .with_for_update(skip_locked=True)
    )


def _counts(db: Session, trip: Trip) -> dict[str, int]:
    """How many rows belong to the trip, per table. Children of a version are counted here and removed by cascade."""
    version_ids = list(db.scalars(select(PlanVersion.id).where(PlanVersion.trip_id == trip.id)))
    return {
        "conversation_turn": _count(db, ConversationTurn, ConversationTurn.trip_id, [trip.id]),
        "planning_job": _count(db, PlanningJob, PlanningJob.trip_id, [trip.id]),
        "plan_proposal": _count(db, PlanProposal, PlanProposal.trip_id, [trip.id]),
        "trip_create_receipt": _count(db, CreateReceipt, CreateReceipt.trip_id, [trip.id]),
        "destination_stop": _count(db, DestinationStop, DestinationStop.version_id, version_ids),
        "activity": _count(db, Activity, Activity.version_id, version_ids),
        "cost_item": _count(db, CostItem, CostItem.version_id, version_ids),
        "plan_version": len(version_ids),
        "trip": 1,
    }


def erase_trip(db: Session, trip_id: UUID, cutoff: datetime, dry_run: bool = False) -> Erasure | None:
    """Erase one due trip inside the caller's transaction, or report what would go. None if it is not due."""
    trip = _due(db, trip_id, cutoff)
    if trip is None:
        return None
    rows = _counts(db, trip)
    if dry_run:
        return Erasure(trip_id=trip_id, rows=rows)
    _declare_erasure(db, trip.id)
    try:
        _remove_conversation(db, trip.id)
        _remove_jobs(db, trip.id)
        _remove_proposals(db, trip.id)
        _remove_receipts(db, trip.id)
        _remove_versions(db, trip)
        _remove_trip_row(db, trip)
    finally:
        _declare_erasure(db, None)
    return Erasure(trip_id=trip_id, rows=rows, erased=True)


@contextmanager
def transaction():
    """A session whose work commits together on success and rolls back entirely on any error."""
    with Session(engine) as db, db.begin():
        yield db


def erase_expired_trips(
    open_transaction=transaction,
    *,
    now: datetime | None = None,
    retention_days: int | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> list[Erasure]:
    """Erase, oldest first, up to `limit` trips deleted more than the retention period ago. Never raises for one bad trip."""
    now = now or datetime.now(timezone.utc)
    cutoff = retention_cutoff(now, settings.trip_retention_days if retention_days is None else retention_days)
    limit = settings.trip_purge_batch if limit is None else limit
    with open_transaction() as db:
        due = list(
            db.scalars(
                select(Trip.id)
                .where(Trip.deleted_at.is_not(None), Trip.deleted_at < cutoff)
                .order_by(Trip.deleted_at, Trip.id)
                .limit(limit)
            )
        )
    results: list[Erasure] = []
    for trip_id in due:
        try:
            with open_transaction() as db:
                result = erase_trip(db, trip_id, cutoff, dry_run)
        except Exception as error:
            # Only the kind of error: the message could name a row or a value.
            logger.warning("Could not erase trip %s (%s); it will be tried again.", str(trip_id)[:8], type(error).__name__)
            results.append(Erasure(trip_id=trip_id, error=type(error).__name__))
            continue
        if result is not None:
            results.append(result)
            if result.erased:
                logger.info("Erased trip %s (%s rows).", str(trip_id)[:8], sum(result.rows.values()))
    return results


def purge_job() -> list[Erasure]:
    """The scheduled run: erase what is due, if erasure is switched on."""
    return erase_expired_trips() if settings.trip_purge_enabled else []


def main(argv: list[str] | None = None, open_transaction=transaction) -> int:
    parser = argparse.ArgumentParser(description="Erase trips deleted more than the recovery window ago.")
    parser.add_argument("--execute", action="store_true", help="really erase; without it nothing is changed")
    parser.add_argument("--limit", type=int, default=None, help="at most this many trips")
    args = parser.parse_args(argv)
    results = erase_expired_trips(open_transaction, limit=args.limit, dry_run=not args.execute)
    verb = "erased" if args.execute else "would erase"
    print(f"Recovery window: {settings.trip_retention_days} days.")
    for r in results:
        detail = f"failed ({r.error})" if r.error else ", ".join(f"{t} {n}" for t, n in r.rows.items() if n)
        print(f"{verb if not r.error else 'did not erase'} {r.trip_id}: {detail}")
    print(f"{len([r for r in results if not r.error])} trip(s) {verb}; {len([r for r in results if r.error])} failed.")
    return 1 if any(r.error for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
