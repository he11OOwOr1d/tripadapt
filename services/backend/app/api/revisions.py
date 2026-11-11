"""Owned accepted history and immutable-snapshot restoration proposals."""

from datetime import datetime
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.proposals import ProposalView, persist_candidate, plan_input, proposal_view
from app.api.trips import Envelope, get_version, owned, router, wrap
from app.persistence.models import (
    Activity,
    AppUser,
    DestinationStop,
    PlanProposal,
    PlanVersion,
)
from app.planning.restoration import restoration_report
from app.trips.schemas import StrictModel


class RevisionView(StrictModel):
    id: UUID
    version_number: int
    source: str
    accepted_at: datetime | None
    current: bool
    destinations: list[str]
    activity_count: int
    traveler_count: int


class RevisionPage(StrictModel):
    revisions: list[RevisionView]
    next_before: int | None


@router.get("/trips/{trip_id}/revisions", response_model=Envelope[RevisionPage])
def revisions(
    trip_id: UUID,
    request: Request,
    before: int | None = Query(None, gt=0),
    limit: int = Query(20, ge=1, le=50),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id)
    query = select(PlanVersion).where(
        PlanVersion.trip_id == trip.id, PlanVersion.status == "accepted"
    )
    if before is not None:
        query = query.where(PlanVersion.version_number < before)
    rows = list(
        db.scalars(query.order_by(PlanVersion.version_number.desc()).limit(limit + 1))
    )
    ids = [row.id for row in rows[:limit]]
    destinations = {ident: [] for ident in ids}
    for ident, name in db.execute(
        select(DestinationStop.version_id, DestinationStop.name)
        .where(DestinationStop.version_id.in_(ids))
        .order_by(DestinationStop.version_id, DestinationStop.position)
    ):
        destinations[ident].append(name)
    counts = dict(
        db.execute(
            select(Activity.version_id, func.count(Activity.id))
            .where(Activity.version_id.in_(ids))
            .group_by(Activity.version_id)
        ).all()
    )
    results = [
        dict(
            id=row.id,
            version_number=row.version_number,
            source=row.source,
            accepted_at=row.accepted_at,
            current=trip.current_version_id == row.id,
            destinations=destinations[row.id],
            activity_count=counts.get(row.id, 0),
            traveler_count=row.traveler_count,
        )
        for row in rows[:limit]
    ]
    return wrap(
        request,
        dict(
            revisions=results,
            next_before=rows[limit - 1].version_number if len(rows) > limit else None,
        ),
    )


@router.post(
    "/trips/{trip_id}/revisions/{version_id}/restore",
    status_code=202,
    response_model=Envelope[ProposalView],
)
def restore(
    trip_id: UUID,
    version_id: UUID,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=True)
    if if_match is None or idempotency_key is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    target = get_version(db, user, trip_id, version_id)
    if target.status != "accepted":
        raise HTTPException(409, "REVISION_NOT_ACCEPTED")
    previous = db.scalar(
        select(PlanProposal).where(
            PlanProposal.trip_id == trip.id, PlanProposal.submit_key == idempotency_key
        )
    )
    if previous:
        candidate = db.get(PlanVersion, previous.candidate_version_id)
        if (
            candidate.source != "restore"
            or candidate.parent_version_id != target.id
            or if_match
            != f'"draft:{previous.base_draft_id}:{previous.base_edit_sequence}"'
        ):
            raise HTTPException(409, "IDEMPOTENCY_KEY_REUSED")
        response.headers["Location"] = (
            f"/api/v1/trips/{trip_id}/proposals/{previous.id}"
        )
        return wrap(request, proposal_view(db, previous))
    draft = (
        db.get(PlanVersion, trip.draft_version_id) if trip.draft_version_id else None
    )
    if (
        draft is None
        or draft.status != "draft"
        or if_match != f'"draft:{draft.id}:{draft.edit_sequence}"'
    ):
        raise HTTPException(412, "PRECONDITION_FAILED")
    plan = plan_input(db, target)
    current = plan_input(db, draft)
    report = restoration_report(current, plan)
    original = {str(a.logical_id): a for a in current.activities}
    restored = {str(a.logical_id): a for a in plan.activities}
    report["restoration"] = dict(
        version_number=target.version_number,
        added=sum(k not in original for k in restored),
        removed=sum(k not in restored for k in original),
        changed=sum(k in original and original[k] != a for k, a in restored.items()),
        settings_changed=current.model_dump(exclude={"activities"})
        != plan.model_dump(exclude={"activities"}),
    )
    proposal = persist_candidate(
        db, trip, draft, plan, idempotency_key, report, source="restore"
    )
    db.get(PlanVersion, proposal.candidate_version_id).parent_version_id = target.id
    response.headers["Location"] = f"/api/v1/trips/{trip_id}/proposals/{proposal.id}"
    return wrap(request, proposal_view(db, proposal))
