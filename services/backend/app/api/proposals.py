"""Frozen manual proposals share the future agent acceptance boundary."""

import hashlib
import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.trips import (
    Envelope,
    activity_inputs,
    get_version,
    owned,
    router,
    sync_route,
    wrap,
)
from app.persistence.models import AppUser, DestinationStop, PlanProposal, PlanVersion
from app.planning.validation import validate_plan
from app.trips.schemas import PlanInput, StrictModel


class AcceptProposal(StrictModel):
    expected_current_version_id: UUID | None
    acknowledged_issue_ids: list[str] = []


class ValidationIssue(StrictModel):
    id: str
    code: str
    detail: str
    activity_id: str | None
    blocking: bool
    acknowledgeable: bool


class ValidationReport(StrictModel):
    status: str
    issues: list[ValidationIssue]


class ProposalView(StrictModel):
    id: UUID
    status: str
    source: str
    candidate_version_id: UUID
    base_current_version_id: UUID | None
    base_draft_id: UUID
    base_edit_sequence: int
    validation: ValidationReport
    plan: PlanInput
    generation: dict | None = None


def plan_input(db, row):
    data = {
        name: getattr(row, name)
        for name in PlanInput.model_fields
        if hasattr(row, name)
    }
    data["budget"] = (
        {"amount": row.budget_amount, "mode": row.budget_mode}
        if row.budget_amount is not None
        else None
    )
    data["activities"] = activity_inputs(db, row)
    data["stops"] = [
        dict(
            client_id=str(s.logical_item_id),
            name=s.name,
            timezone=s.timezone,
            desired_nights=s.suggested_nights,
            arrival_date=s.arrival_date,
            departure_date=s.departure_date,
        )
        for s in db.scalars(
            select(DestinationStop)
            .where(DestinationStop.version_id == row.id)
            .order_by(DestinationStop.position)
        )
    ]
    return PlanInput.model_validate(data)


def proposal_view(db, proposal):
    candidate = db.get(PlanVersion, proposal.candidate_version_id)
    from app.persistence.models import PlanningJob

    job = db.scalar(select(PlanningJob).where(PlanningJob.proposal_id == proposal.id))
    return dict(
        generation=job.result_metadata
        if job
        else (
            {
                "operation": "restore_plan",
                "restoration": candidate.validation_report.get("restoration"),
            }
            if candidate.source == "restore"
            else None
        ),
        id=proposal.id,
        status=proposal.status,
        source="fixture"
        if any(
            i["code"] == "FIXTURE_ONLY"
            for i in candidate.validation_report.get("issues", [])
        )
        else "ai"
        if job and job.input["request"]["engine"] == "groq"
        else candidate.source,
        candidate_version_id=candidate.id,
        base_current_version_id=proposal.base_current_id,
        base_draft_id=proposal.base_draft_id,
        base_edit_sequence=proposal.base_edit_sequence,
        validation={
            key: candidate.validation_report[key] for key in ("status", "issues")
        },
        plan=plan_input(db, candidate).model_dump(mode="json"),
    )


def find_proposal(db, trip_id, proposal_id):
    result = db.scalar(
        select(PlanProposal).where(
            PlanProposal.id == proposal_id, PlanProposal.trip_id == trip_id
        )
    )
    if result is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    return result


def apply_plan(row, plan):
    values = plan.model_dump(exclude={"stops", "activities", "budget"}, mode="python")
    for key in ("preferences", "origin", "return_location"):
        value = getattr(plan, key)
        values[key] = value.model_dump(mode="json") if value else None
    for key, value in values.items():
        setattr(row, key, value)
    row.budget_amount = plan.budget.amount if plan.budget else None
    row.budget_mode = plan.budget.mode if plan.budget else "target"


def persist_candidate(db, trip, draft, plan, key, report, source="user"):
    fields = {
        c.name: getattr(draft, c.name)
        for c in PlanVersion.__table__.columns
        if c.name
        not in {
            "id",
            "version_number",
            "status",
            "source",
            "edit_sequence",
            "validation_status",
            "validation_report",
            "created_at",
            "accepted_at",
        }
    }
    candidate = PlanVersion(
        **fields,
        version_number=db.scalar(
            select(func.max(PlanVersion.version_number)).where(
                PlanVersion.trip_id == trip.id
            )
        )
        + 1,
        status="proposed",
        source=source,
        validation_status=report["status"],
        validation_report=report,
    )
    apply_plan(candidate, plan)
    db.add(candidate)
    db.flush()
    sync_route(db, candidate, plan.stops, plan.activities, cascade=True)
    proposal = PlanProposal(
        trip_id=trip.id,
        candidate_version_id=candidate.id,
        base_draft_id=draft.id,
        base_edit_sequence=draft.edit_sequence,
        base_current_id=trip.current_version_id,
        submit_key=key,
    )
    db.add(proposal)
    db.flush()
    return proposal


@router.post(
    "/trips/{trip_id}/draft/submit",
    status_code=201,
    response_model=Envelope[ProposalView],
)
def submit(
    trip_id: UUID,
    request: Request,
    if_match: str | None = Header(None),
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=True)
    if idempotency_key is None or if_match is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    previous = db.scalar(
        select(PlanProposal).where(
            PlanProposal.trip_id == trip.id, PlanProposal.submit_key == idempotency_key
        )
    )
    if previous:
        if (
            if_match
            != f'"draft:{previous.base_draft_id}:{previous.base_edit_sequence}"'
        ):
            raise HTTPException(409, "IDEMPOTENCY_KEY_REUSED")
        return wrap(request, proposal_view(db, previous))
    if trip.draft_version_id is None:
        raise HTTPException(409, "DRAFT_UNAVAILABLE")
    draft = get_version(db, user, trip_id, trip.draft_version_id)
    if (
        draft.status != "draft"
        or if_match != f'"draft:{draft.id}:{draft.edit_sequence}"'
    ):
        raise HTTPException(412, "PRECONDITION_FAILED")
    plan = plan_input(db, draft)
    report = validate_plan(plan)
    proposal = persist_candidate(db, trip, draft, plan, idempotency_key, report)
    return wrap(request, proposal_view(db, proposal))


@router.get(
    "/trips/{trip_id}/proposals/{proposal_id}", response_model=Envelope[ProposalView]
)
def get_proposal(
    trip_id: UUID,
    proposal_id: UUID,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    owned(db, user, trip_id)
    return wrap(request, proposal_view(db, find_proposal(db, trip_id, proposal_id)))


@router.post(
    "/trips/{trip_id}/proposals/{proposal_id}/accept",
    response_model=Envelope[ProposalView],
)
def accept(
    trip_id: UUID,
    proposal_id: UUID,
    body: AcceptProposal,
    request: Request,
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=True)
    proposal = find_proposal(db, trip_id, proposal_id)
    if idempotency_key is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "current": str(body.expected_current_version_id),
                "ack": sorted(set(body.acknowledged_issue_ids)),
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    if proposal.status == "accepted":
        if (
            proposal.accept_key == idempotency_key
            and proposal.accept_fingerprint == fingerprint
        ):
            return wrap(request, proposal_view(db, proposal))
        raise HTTPException(409, "PROPOSAL_NOT_PENDING")
    if proposal.status != "pending":
        raise HTTPException(409, "PROPOSAL_NOT_PENDING")
    draft = db.get(PlanVersion, trip.draft_version_id)
    if (
        trip.current_version_id != body.expected_current_version_id
        or trip.current_version_id != proposal.base_current_id
        or draft is None
        or draft.id != proposal.base_draft_id
        or draft.edit_sequence != proposal.base_edit_sequence
    ):
        raise HTTPException(409, "STALE_PROPOSAL")
    candidate = db.get(PlanVersion, proposal.candidate_version_id)
    candidate_plan = plan_input(db, candidate)
    report = validate_plan(candidate_plan)
    if candidate.source == "agent":
        from app.persistence.models import PlanningJob
        from app.planning.candidate import validate_job_candidate

        job = db.scalar(
            select(PlanningJob).where(PlanningJob.proposal_id == proposal.id)
        )
        if job is None or job.status != "succeeded":
            raise HTTPException(409, "UNSUPPORTED_CANDIDATE")
        try:
            report["issues"].append(
                validate_job_candidate(
                    job.input, candidate_plan, job.id, job.result_metadata or {}
                )
            )
        except (ValueError, KeyError, TypeError):
            raise HTTPException(409, "PLAN_CONFLICT") from None

    if candidate.source == "restore":
        from app.planning.restoration import restoration_report

        historical = db.get(PlanVersion, candidate.parent_version_id)
        if (
            historical is None
            or historical.trip_id != trip.id
            or historical.status != "accepted"
            or plan_input(db, historical) != candidate_plan
        ):
            raise HTTPException(409, "PLAN_CONFLICT")
        report = restoration_report(plan_input(db, draft), candidate_plan)
        report["restoration"] = candidate.validation_report.get("restoration")
    if any(i["blocking"] for i in report["issues"]):
        raise HTTPException(409, "PLAN_CONFLICT")
    required = {i["id"] for i in report["issues"] if i["acknowledgeable"]}
    if set(body.acknowledged_issue_ids) != required:
        raise HTTPException(409, "ACKNOWLEDGEMENT_REQUIRED")
    candidate.status = "accepted"
    candidate.accepted_at = datetime.now(timezone.utc)
    candidate.validation_report = report
    trip.current_version_id = candidate.id
    trip.lock_version += 1
    trip.updated_at = datetime.now(timezone.utc)
    if candidate.source in ("agent", "restore"):
        apply_plan(draft, candidate_plan)
        sync_route(
            db, draft, candidate_plan.stops, candidate_plan.activities, cascade=True
        )
        draft.edit_sequence += 1
        draft.validation_status = "unchecked"
    draft.parent_version_id = candidate.id
    proposal.status = "accepted"
    proposal.accept_key = idempotency_key
    proposal.accept_fingerprint = fingerprint
    db.flush()
    return wrap(request, proposal_view(db, proposal))


@router.post(
    "/trips/{trip_id}/proposals/{proposal_id}/discard",
    response_model=Envelope[ProposalView],
)
def discard(
    trip_id: UUID,
    proposal_id: UUID,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    owned(db, user, trip_id, lock=True)
    proposal = find_proposal(db, trip_id, proposal_id)
    if proposal.status == "accepted":
        raise HTTPException(409, "PROPOSAL_NOT_PENDING")
    proposal.status = "discarded"
    db.get(PlanVersion, proposal.candidate_version_id).status = "rejected"
    db.flush()
    return wrap(request, proposal_view(db, proposal))
