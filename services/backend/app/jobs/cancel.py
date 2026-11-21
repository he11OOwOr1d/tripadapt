"""Stopping planning work, shared by cancelling one job and deleting a whole trip."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.persistence.models import PlanningJob

TERMINAL = {"succeeded", "failed", "cancelled", "superseded"}


def stop_job(job: PlanningJob, stage: str = "Cancelled before planning") -> None:
    """Ask a job to stop. A queued job is cancelled outright; a running one is told to stop and never publishes."""
    if job.status in TERMINAL:
        return
    job.cancel_requested = True
    job.updated_at = datetime.now(timezone.utc)
    if job.status == "queued":
        job.status, job.stage = "cancelled", stage


def stop_trip_jobs(db, trip_id: UUID) -> int:
    """Stop every unfinished job of a trip, and return how many were stopped.

    A job row the worker holds locked at this instant is skipped rather than waited for: the worker takes the job lock
    and then the trip lock, this takes them the other way round, and waiting could deadlock. Skipping is safe because
    the worker re-reads the trip under its lock before publishing and treats a deleted trip as superseded.
    """
    jobs = db.scalars(
        select(PlanningJob)
        .where(PlanningJob.trip_id == trip_id, PlanningJob.status.notin_(TERMINAL))
        .with_for_update(skip_locked=True)
    ).all()
    for job in jobs:
        stop_job(job, "Cancelled because the trip was deleted")
    return len(jobs)
