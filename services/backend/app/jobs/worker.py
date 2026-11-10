"""Run separately: uv run python -m app.jobs.worker [--once]."""

import argparse
import threading
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.agents.conversation import respond
from app.agents.day_graph import run_day_graph
from app.agents.groq_provider import GroqProvider, PlanningFailure
from app.api.proposals import persist_candidate
from app.config import settings
from app.persistence.database import engine
from app.persistence.models import ConversationTurn, PlanningJob, PlanVersion, Trip
from app.planning.candidate import validate_job_candidate
from app.planning.fixture import generate_day
from app.planning.validation import validate_plan
from app.trips.schemas import PlanInput

LEASE_SECONDS = 60
MAX_ATTEMPTS = 3


def now():
    return datetime.now(timezone.utc)


def claim(db, *, owner_id=None):
    stamp = now()
    rows = (
        select(PlanningJob)
        .where(
            or_(
                (PlanningJob.status == "queued") & (PlanningJob.available_at <= stamp),
                (PlanningJob.status == "running") & (PlanningJob.lease_until <= stamp),
            )
        )
        .order_by(PlanningJob.available_at, PlanningJob.id)
        .with_for_update(skip_locked=True)
    )
    if owner_id is not None:
        rows = rows.where(PlanningJob.owner_id == owner_id)
    while True:
        job = db.scalar(rows.limit(1))
        if job is None:
            db.flush()
            return None
        if job.cancel_requested:
            job.status, job.stage = "cancelled", "Cancelled"
        elif job.attempts >= MAX_ATTEMPTS:
            job.status, job.stage, job.error_code = (
                "failed",
                "Planning could not finish",
                "ATTEMPTS_EXHAUSTED",
            )
        else:
            job.status, job.stage = "running", "Preparing the selected day"
            job.attempts += 1
            job.lease_token = uuid4()
            job.lease_until = stamp + timedelta(seconds=LEASE_SECONDS)
            job.heartbeat_at = stamp
            job.updated_at = stamp
            db.flush()
            return job
        job.lease_token = None
        job.lease_until = None
        job.updated_at = stamp
        db.flush()


def leased(db, ident, token):
    job = db.scalar(
        select(PlanningJob).where(PlanningJob.id == ident).with_for_update()
    )
    if (
        job is None
        or job.status != "running"
        or job.lease_token != token
        or job.lease_until <= now()
    ):
        return None
    return job


def heartbeat(db, ident, token):
    job = leased(db, ident, token)
    if job is None:
        return False
    if job.cancel_requested:
        finish(job, "cancelled", "Cancelled")
        return False
    job.heartbeat_at = now()
    job.lease_until = now() + timedelta(seconds=LEASE_SECONDS)
    job.updated_at = now()
    job.stage = "Planning the selected day"
    return True


def finish(job, status, stage):
    job.status, job.stage = status, stage
    job.updated_at = now()
    job.lease_token = None
    job.lease_until = None


def fresh_base(db, job):
    trip = db.scalar(select(Trip).where(Trip.id == job.trip_id).with_for_update())
    draft = db.get(PlanVersion, trip.draft_version_id) if trip else None
    original = job.input
    if (
        trip is None
        or trip.deleted_at is not None
        or trip.owner_id != job.owner_id
        or draft is None
        or str(draft.id) != original["request"]["base_version_id"]
        or draft.edit_sequence != original["base_edit_sequence"]
        or (str(trip.current_version_id) if trip.current_version_id else None)
        != original["base_current_id"]
    ):
        finish(job, "superseded", "Your trip changed; request a new day plan")
        return None
    return trip, draft


def save_reply(db, job, reply):
    turn = db.scalar(select(ConversationTurn).where(ConversationTurn.job_id == job.id))
    if turn is None:
        raise ValueError("Conversation turn missing")
    turn.assistant_text = reply["text"]
    turn.kind = reply["kind"]
    turn.choices = reply["choices"]


def publish_reply(db, ident, token, reply):
    job = leased(db, ident, token)
    if job is None:
        return False
    if job.cancel_requested:
        finish(job, "cancelled", "Cancelled")
        return False
    if fresh_base(db, job) is None:
        return False
    save_reply(db, job, reply)
    finish(job, "succeeded", "Your reply is ready")
    db.flush()
    return True


def publish(db, ident, token, candidate, metadata=None):
    job = leased(db, ident, token)
    if job is None:
        return False
    if job.cancel_requested:
        finish(job, "cancelled", "Cancelled")
        return False
    pair = fresh_base(db, job)
    if pair is None:
        return False
    trip, draft = pair
    original = job.input
    report = validate_plan(candidate)
    report["issues"].append(
        validate_job_candidate(original, candidate, job.id, metadata or {})
    )
    is_ai = original["request"]["engine"] == "groq"
    job.result_metadata = metadata or {}
    proposal = persist_candidate(
        db, trip, draft, candidate, job.id, report, source="agent"
    )
    job.proposal_id = proposal.id
    finish(
        job,
        "succeeded",
        (
            "AI suggestions are ready to review"
            if is_ai
            else "Test suggestions are ready to review"
        )
        if (metadata or {}).get("operation")
        in ("move_activity", "resize_activity", "remove_activity")
        or len(candidate.activities) > len(original["plan"]["activities"])
        else "No open slots; your existing day is unchanged",
    )
    db.flush()
    return True


def retry(db, ident, token, failure=None):
    job = leased(db, ident, token)
    if job is None:
        return
    if job.cancel_requested:
        finish(job, "cancelled", "Cancelled")
    elif job.attempts >= MAX_ATTEMPTS or (
        failure is not None and not failure.retryable
    ):
        finish(job, "failed", "Planning could not finish")
        job.error_code = failure.code if failure else "PLANNING_FAILED"
    else:
        finish(job, "queued", "Retrying after a temporary failure")
        job.available_at = now() + timedelta(
            seconds=max(5 * job.attempts, failure.retry_after if failure else 0)
        )
        job.error_code = failure.code if failure else None


def run_once():
    if not settings.planning_fixtures_enabled and not settings.planning_ai_enabled:
        return False
    with Session(engine) as db, db.begin():
        job = claim(db)
        if job is None:
            return False
        ident, token, payload = job.id, job.lease_token, job.input
    stopped = threading.Event()
    lost = threading.Event()

    def progress(stage):
        if lost.is_set():
            raise PlanningFailure("AI_CANCELLED_OR_LEASE_LOST")
        with Session(engine) as db, db.begin():
            if not heartbeat(db, ident, token):
                lost.set()
                raise PlanningFailure("AI_CANCELLED_OR_LEASE_LOST")
            db.get(PlanningJob, ident).stage = stage

    def keep_alive():
        while not stopped.wait(10):
            try:
                progress("Planning the selected day")
            except Exception:
                lost.set()
                return

    thread = threading.Thread(target=keep_alive, daemon=True)
    thread.start()
    try:
        progress("Reading the saved day")
        scope = payload["request"]["scope"]
        plan = PlanInput.model_validate(payload["plan"])
        metadata = None
        reply = None
        candidate = None
        if payload["request"]["engine"] == "groq":
            if not settings.planning_ai_enabled:
                raise PlanningFailure("AI_NOT_CONFIGURED")
            is_chat = payload["request"]["operation"] == "chat"
            provider = GroqProvider(max_calls=6 if is_chat else 5)
            try:
                if is_chat:
                    progress("Understanding your message")
                    reply = respond(
                        plan,
                        scope,
                        payload["request"]["instructions"],
                        payload.get("conversation", []),
                        provider,
                    )
                if reply is not None and "candidate" in reply:
                    progress("Checking the requested time change")
                    candidate, metadata = reply.pop("candidate"), reply.pop("metadata")
                    metadata.update(model=settings.groq_model, calls=provider.calls)
                elif reply is None or reply["kind"] == "proposal":
                    candidate, metadata = run_day_graph(
                        plan,
                        scope["stop_logical_id"],
                        scope["local_day_offset"],
                        ident,
                        provider,
                        progress,
                        instructions=payload["request"].get("instructions", ""),
                        candidate_ids=reply.get("candidate_ids") if reply else None,
                    )
                    metadata["model"] = settings.groq_model
            finally:
                provider.close()
        else:
            candidate = generate_day(
                plan, scope["stop_logical_id"], scope["local_day_offset"], ident
            )
        stopped.set()
        thread.join(timeout=5)
        if lost.is_set():
            return True
        with Session(engine) as db, db.begin():
            if candidate is None:
                publish_reply(db, ident, token, reply)
            elif publish(db, ident, token, candidate, metadata) and reply is not None:
                save_reply(db, db.get(PlanningJob, ident), reply)
    except Exception as error:
        stopped.set()
        thread.join(timeout=5)
        failure = (
            error
            if isinstance(error, PlanningFailure)
            else PlanningFailure("PLANNING_FAILED")
        )
        with Session(engine) as db, db.begin():
            retry(db, ident, token, failure)
        print(
            "Planning attempt ended; see the safe job status for details.", flush=True
        )
    finally:
        stopped.set()

    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if not settings.planning_fixtures_enabled and not settings.planning_ai_enabled:
        raise SystemExit(
            "Fixture planning is disabled. Set PLANNING_FIXTURES_ENABLED=true for local testing."
        )
    print(
        "Planning worker ready; enabled engines are controlled by backend settings.",
        flush=True,
    )
    while True:
        worked = run_once()
        if args.once:
            break
        if not worked:
            time.sleep(1)


if __name__ == "__main__":
    main()
