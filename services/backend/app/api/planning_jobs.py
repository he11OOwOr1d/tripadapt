"""Bounded draft-based one-day fixture planning admission and polling."""

import hashlib
import json
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.proposals import plan_input
from app.api.trips import Envelope, owned, router, wrap
from app.config import settings
from app.persistence.models import AppUser, PlanningJob, PlanVersion, SystemProbe
from app.trips.schemas import StrictModel

TERMINAL = {"succeeded", "failed", "cancelled", "superseded"}


class DayScope(StrictModel):
    type: Literal["selected_day"]
    stop_logical_id: UUID
    local_day_offset: int = Field(ge=0)


class PlanningRequest(StrictModel):
    evidence: Literal["sample", "places"] = "sample"
    operation: Literal["generate"]
    instructions: str = Field(default="", max_length=2000)
    engine: Literal["fixture", "groq"]
    base_version_id: UUID
    scope: DayScope


class ConversationJobRequest(PlanningRequest):
    operation: Literal["chat"]


class JobView(StrictModel):
    id: UUID
    scope: DayScope
    destination_name: str
    trip_id: UUID
    status: str
    stage: str
    attempts: int
    cancel_requested: bool
    proposal_id: UUID | None
    error_code: str | None
    updated_at: datetime
    evidence: Literal["sample", "places"] = "sample"
    engine: Literal["fixture", "groq"] = "fixture"
    poll_after_seconds: int = 2


def job_view(job):
    data = {
        field: getattr(job, field)
        for field in JobView.model_fields
        if hasattr(job, field)
    }
    scope = job.input["request"]["scope"]
    data["engine"] = job.input["request"]["engine"]
    data["evidence"] = job.input["request"].get("evidence", "sample")
    data["scope"] = scope
    data["destination_name"] = next(
        s["name"]
        for s in job.input["plan"]["stops"]
        if s["client_id"] == scope["stop_logical_id"]
    )
    return data


def admit_job(
    trip_id: UUID,
    body: PlanningRequest,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    # Short admission lock bounds global and per-owner outstanding work.
    db.scalar(select(SystemProbe).where(SystemProbe.id == 1).with_for_update())
    trip = owned(db, user, trip_id, lock=True)
    if body.engine == "fixture" and not settings.planning_fixtures_enabled:
        raise HTTPException(503, "FIXTURE_PLANNING_DISABLED")
    if body.engine == "groq" and (
        not settings.planning_ai_enabled or not settings.groq_api_key.get_secret_value()
    ):
        raise HTTPException(503, "AI_NOT_CONFIGURED")
    if if_match is None or idempotency_key is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    fingerprint_body = body.model_dump(mode="json")
    # Preserve retry keys created before evidence mode was an explicit field.
    if body.evidence == "sample":
        fingerprint_body.pop("evidence")
    fingerprint = hashlib.sha256(
        json.dumps(
            {"body": fingerprint_body, "etag": if_match}, sort_keys=True
        ).encode()
    ).hexdigest()
    previous = db.scalar(
        select(PlanningJob).where(
            PlanningJob.trip_id == trip_id,
            PlanningJob.idempotency_key == idempotency_key,
        )
    )
    if previous:
        if previous.fingerprint != fingerprint:
            raise HTTPException(409, "IDEMPOTENCY_KEY_REUSED")
        result = previous
    else:
        row = db.get(PlanVersion, body.base_version_id)
        if (
            row is None
            or row.trip_id != trip.id
            or row.id != trip.draft_version_id
            or row.status != "draft"
        ):
            raise HTTPException(409, "STALE_BASE")
        if if_match != f'"draft:{row.id}:{row.edit_sequence}"':
            raise HTTPException(412, "PRECONDITION_FAILED")
        plan = plan_input(db, row)
        stop = next(
            (s for s in plan.stops if s.client_id == str(body.scope.stop_logical_id)),
            None,
        )
        if (
            stop is None
            or stop.desired_nights is None
            or body.scope.local_day_offset > stop.desired_nights
        ):
            raise HTTPException(422, "DAY_OUTSIDE_STAY")
        active = select(PlanningJob).where(
            PlanningJob.status.in_(["queued", "running"])
        )
        if db.scalar(
            select(func.count()).select_from(
                active.where(PlanningJob.trip_id == trip.id).subquery()
            )
        ):
            raise HTTPException(409, "PLANNING_ALREADY_RUNNING")
        if (
            db.scalar(select(func.count()).select_from(active.subquery())) >= 20
            or db.scalar(
                select(func.count()).select_from(
                    active.where(PlanningJob.owner_id == user.id).subquery()
                )
            )
            >= 2
        ):
            raise HTTPException(
                429, "PLANNING_CAPACITY_REACHED", headers={"Retry-After": "10"}
            )
        result = PlanningJob(
            trip_id=trip.id,
            owner_id=user.id,
            idempotency_key=idempotency_key,
            fingerprint=fingerprint,
            input={
                "request": body.model_dump(mode="json"),
                "plan": plan.model_dump(mode="json"),
                "base_edit_sequence": row.edit_sequence,
                "base_current_id": str(trip.current_version_id)
                if trip.current_version_id
                else None,
            },
        )
        db.add(result)
        db.flush()
    response.headers["Location"] = f"/api/v1/jobs/{result.id}"
    response.headers["Retry-After"] = "2"
    return wrap(request, job_view(result))


@router.post(
    "/trips/{trip_id}/planning-jobs", status_code=202, response_model=Envelope[JobView]
)
def create_job(
    trip_id: UUID,
    body: PlanningRequest,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    if body.operation != "generate":
        raise HTTPException(422, "USE_MESSAGES_ENDPOINT")
    return admit_job(
        trip_id, body, request, response, if_match, idempotency_key, user, db
    )


def owned_job(db, user, ident, lock=False):
    query = select(PlanningJob).where(
        PlanningJob.id == ident, PlanningJob.owner_id == user.id
    )
    job = db.scalar(query.with_for_update() if lock else query)
    if job is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    owned(db, user, job.trip_id)
    return job


@router.get("/jobs/{job_id}", response_model=Envelope[JobView])
def get_job(
    job_id: UUID,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    return wrap(request, job_view(owned_job(db, user, job_id)))


@router.post("/jobs/{job_id}/cancel", status_code=202, response_model=Envelope[JobView])
def cancel_job(
    job_id: UUID,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    job = owned_job(db, user, job_id, lock=True)
    if job.status not in TERMINAL:
        job.cancel_requested = True
        job.updated_at = datetime.now(timezone.utc)
        if job.status == "queued":
            job.status, job.stage = "cancelled", "Cancelled before planning"
    db.flush()
    return wrap(request, job_view(job))
