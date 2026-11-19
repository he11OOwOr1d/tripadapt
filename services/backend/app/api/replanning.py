"""Owned, explicit-basis remaining-day readiness. No proposal or location tracking."""

from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import Depends, Header, HTTPException, Query, Request, Response
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.proposals import ProposalView, plan_input
from app.api.trips import Envelope, owned, router, wrap
from app.discovery.activities import PlaceDetail, detail
from app.persistence.models import AppUser, DiscoveredPlace, PlanVersion
from app.planning.live_acceptance import planned_visit_date
from app.planning.readiness import (
    ReadinessActivity,
    ReadinessInput,
    activity_view,
    readiness_report,
    scoped_day,
)
from app.planning.remaining_day import RemainingDayInput
from app.trips.schemas import StrictModel

Basis = Literal["accepted", "draft"]


class ReadinessContext(StrictModel):
    basis: Basis
    base_version_id: UUID
    base_etag: str
    version_number: int
    stop_id: UUID
    local_day_offset: int
    destination: str
    timezone: str
    destination_reference_id: UUID | None
    scheduled_date: date | None
    current_local_date: date
    current_local_time: str
    utc_offset_minutes: int
    captured_at: datetime
    activities: list[ReadinessActivity]
    known_locations: list[PlaceDetail]


class ReadinessIssue(StrictModel):
    code: str
    detail: str
    activity_ids: list[UUID]


class ReadinessView(StrictModel):
    status: Literal["needs_attention", "ready_for_proposal"]
    basis: Basis
    base_version_id: UUID
    base_etag: str
    scope: Literal["remaining_day"]
    stop_id: UUID
    local_day_offset: int
    timezone: str
    reported_at: datetime
    checked_at: datetime
    expires_at: datetime
    current_location: PlaceDetail
    completed: list[ReadinessActivity]
    skipped: list[ReadinessActivity]
    past_unresolved: list[ReadinessActivity]
    in_progress: list[ReadinessActivity]
    protected: list[ReadinessActivity]
    flexible: list[ReadinessActivity]
    issues: list[ReadinessIssue]


def chosen_base(db, trip, basis):
    if trip.lifecycle not in ("planning", "active"):
        raise HTTPException(409, "REPLAN_TRIP_CLOSED")
    ident = trip.current_version_id if basis == "accepted" else trip.draft_version_id
    row = db.get(PlanVersion, ident) if ident else None
    if (
        row is None
        or row.trip_id != trip.id
        or row.status != ("accepted" if basis == "accepted" else "draft")
    ):
        raise HTTPException(409, "REPLAN_BASE_UNAVAILABLE")
    token = (
        f'"accepted:{row.id}"'
        if basis == "accepted"
        else f'"draft:{row.id}:{row.edit_sequence}"'
    )
    return row, token


def current_time():
    return datetime.now(timezone.utc)


@router.get(
    "/trips/{trip_id}/replanning/context", response_model=Envelope[ReadinessContext]
)
def replan_context(
    trip_id: UUID,
    request: Request,
    response: Response,
    basis: Basis,
    stop_id: UUID,
    local_day_offset: int = Query(ge=0),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    response.headers["Cache-Control"] = "private, no-store"
    trip = owned(db, user, trip_id)
    row, token = chosen_base(db, trip, basis)
    plan = plan_input(db, row)
    try:
        stop, day = scoped_day(plan, stop_id, local_day_offset)
    except ValueError:
        raise HTTPException(409, "REPLAN_SCOPE_UNAVAILABLE") from None
    stamp = current_time()
    local = stamp.astimezone(ZoneInfo(stop.timezone))
    ids = {
        a.place_id
        for a in plan.activities
        if str(a.stop_logical_id) == stop.client_id and a.place_id
    }
    # A searched stay can be where the traveler is; the destination check below
    # keeps a stale or foreign record out.
    preference = plan.preferences.stay_preferences.get(stop.client_id)
    if preference and preference.lodging and preference.lodging.place_id:
        ids.add(preference.lodging.place_id)
    locations = (
        [
            detail(place)
            for place in db.scalars(
                select(DiscoveredPlace).where(
                    DiscoveredPlace.id.in_(ids),
                    DiscoveredPlace.destination_reference_id == stop.place_reference_id,
                )
            )
        ]
        if stop.place_reference_id
        else []
    )
    return wrap(
        request,
        ReadinessContext(
            basis=basis,
            base_version_id=row.id,
            base_etag=token,
            version_number=row.version_number,
            stop_id=stop_id,
            local_day_offset=local_day_offset,
            destination=stop.name,
            timezone=stop.timezone,
            destination_reference_id=stop.place_reference_id,
            scheduled_date=planned_visit_date(
                plan,
                {
                    "scope": {
                        "stop_logical_id": str(stop_id),
                        "local_day_offset": local_day_offset,
                    }
                },
            ),
            current_local_date=local.date(),
            current_local_time=local.strftime("%H:%M"),
            utc_offset_minutes=int(local.utcoffset().total_seconds() / 60),
            captured_at=stamp,
            activities=[activity_view(a) for a in day],
            known_locations=sorted(
                locations, key=lambda p: (p.name.casefold(), str(p.id))
            ),
        ),
    )


@router.post(
    "/trips/{trip_id}/replanning/readiness", response_model=Envelope[ReadinessView]
)
def check_readiness(
    trip_id: UUID,
    body: ReadinessInput,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    response.headers["Cache-Control"] = "private, no-store"
    trip = owned(db, user, trip_id)
    if if_match is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    row, token = chosen_base(db, trip, body.basis)
    if row.id != body.base_version_id or token != if_match:
        raise HTTPException(409, "REPLAN_BASE_CHANGED")
    plan = plan_input(db, row)
    try:
        stop, _ = scoped_day(plan, body.stop_id, body.local_day_offset)
        report = readiness_report(plan, body, current_time())
    except ValueError as error:
        raise HTTPException(409, str(error)) from None
    place = db.get(DiscoveredPlace, body.current_location_place_id)
    if (
        place is None
        or stop.place_reference_id is None
        or place.destination_reference_id != stop.place_reference_id
    ):
        raise HTTPException(409, "REPLAN_LOCATION_MISMATCH")
    return wrap(
        request,
        ReadinessView(
            basis=body.basis,
            base_version_id=row.id,
            base_etag=token,
            scope="remaining_day",
            stop_id=body.stop_id,
            local_day_offset=body.local_day_offset,
            timezone=stop.timezone,
            current_location=detail(place),
            **report,
        ),
    )


class PreviewActivity(StrictModel):
    activity_id: UUID
    label: str
    before: str
    after: str
    duration_minutes: int
    protected: bool


class PreviewJourney(StrictModel):
    origin_place_id: UUID
    destination_place_id: UUID
    destination_activity_id: UUID
    travel_minutes: int
    buffer_minutes: int


class SkippedActivity(StrictModel):
    activity_id: UUID
    label: str
    start: str
    duration_minutes: int


class RemainingPreview(StrictModel):
    basis: Basis
    base_version_id: UUID
    base_etag: str
    stop_id: UUID
    local_day_offset: int
    mode: Literal["WALK", "DRIVE"]
    checked_at: datetime
    changes: list[PreviewActivity]
    journeys: list[PreviewJourney]
    rest_minutes: int
    skipped: list[SkippedActivity]
    unchanged: bool
    notice: str


@router.post(
    "/trips/{trip_id}/replanning/preview", response_model=Envelope[RemainingPreview]
)
def preview_remaining_day(
    trip_id: UUID,
    body: RemainingDayInput,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    # No route results or traveler-location report are persisted here.
    from app.api.journeys import geoapify_checks
    from app.api.place_checks import fail
    from app.planning.remaining_day import PreviewConflict, remaining_day_preview
    from app.providers.geoapify_checks import CheckFailure

    response.headers["Cache-Control"] = "private, no-store"
    trip = owned(db, user, trip_id)
    if if_match is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    row, token = chosen_base(db, trip, body.basis)
    if row.id != body.base_version_id or token != if_match:
        raise HTTPException(409, "REPLAN_BASE_CHANGED")
    plan = plan_input(db, row)
    try:
        stop, _ = scoped_day(plan, body.stop_id, body.local_day_offset)
        readiness_report(plan, body, current_time())
        location = db.get(DiscoveredPlace, body.current_location_place_id)
        if (
            location is None
            or stop.place_reference_id is None
            or location.destination_reference_id != stop.place_reference_id
        ):
            raise HTTPException(409, "REPLAN_LOCATION_MISMATCH")

        estimates = {}

        def estimate(origin_id, destination_id):
            origin = db.get(DiscoveredPlace, origin_id)
            destination = db.get(DiscoveredPlace, destination_id)
            if any(
                p is None or p.destination_reference_id != stop.place_reference_id
                for p in (origin, destination)
            ):
                raise PreviewConflict(
                    "REPLAN_MAP_REQUIRED",
                    "A remaining map location does not belong to this destination. Relink it in the plan.",
                )
            if origin_id == destination_id:
                estimates[(origin_id, destination_id)] = 0
                return 0

            minutes, _, warnings = geoapify_checks.route(
                str(user.id),
                body.mode,
                (origin.payload["latitude"], origin.payload["longitude"]),
                (destination.payload["latitude"], destination.payload["longitude"]),
            )
            if warnings:
                raise PreviewConflict(
                    "REPLAN_ROUTE_WARNING",
                    "A connecting route returned an access warning. Review it manually; no preview is treated as feasible.",
                )
            estimates[(origin_id, destination_id)] = minutes
            return minutes

        result = remaining_day_preview(plan, body, current_time(), estimate)
        # Re-read the pointers and sequence after network calls; the initial
        # readiness response is neither a token nor permission to use stale data.
        db.refresh(trip)
        db.refresh(row)
        latest, latest_token = chosen_base(db, trip, body.basis)
        if latest.id != row.id or latest_token != token:
            raise HTTPException(409, "REPLAN_BASE_CHANGED")
        checked = current_time()
        result = remaining_day_preview(
            plan,
            body,
            checked,
            lambda origin, destination: estimates[(origin, destination)],
        )
    except PreviewConflict as error:
        raise HTTPException(409, error.code) from None
    except ValueError as error:
        raise HTTPException(409, str(error)) from None
    except CheckFailure as error:
        fail(error)
    return wrap(
        request,
        dict(
            basis=body.basis,
            base_version_id=str(row.id),
            base_etag=token,
            stop_id=str(body.stop_id),
            local_day_offset=body.local_day_offset,
            mode=body.mode,
            checked_at=checked.isoformat(),
            **result,
            notice="Read-only timing preview. No plan saved or changed. Route estimates exclude traffic; venue hours, weather and reservations have not been checked.",
        ),
    )


class SaveRemainingInput(RemainingDayInput):
    # Empty only when every remaining activity is explicitly skipped.
    preview_changes: list[PreviewActivity] = Field(max_length=6)


@router.post(
    "/trips/{trip_id}/proposals/remaining-day",
    status_code=201,
    response_model=Envelope[ProposalView],
)
def save_remaining_day(
    trip_id: UUID,
    body: SaveRemainingInput,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    from app.api.proposals import persist_candidate, proposal_view
    from app.persistence.models import PlanProposal
    from app.planning.remaining_proposal import (
        REMAINING_ISSUE,
        apply_remaining,
        fatigue_issue,
    )
    from app.planning.validation import same_plan, validate_plan

    response.headers["Cache-Control"] = "private, no-store"
    trip = owned(db, user, trip_id, lock=True)
    if if_match is None or idempotency_key is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    fingerprint = body.model_dump(mode="json")
    previous = db.scalar(
        select(PlanProposal).where(
            PlanProposal.trip_id == trip.id, PlanProposal.submit_key == idempotency_key
        )
    )
    if previous:
        metadata = db.get(
            PlanVersion, previous.candidate_version_id
        ).validation_report.get("remaining_day", {})
        if (
            metadata.get("save_request") != fingerprint
            or metadata.get("base_etag") != if_match
        ):
            raise HTTPException(409, "IDEMPOTENCY_KEY_REUSED")
        return wrap(request, proposal_view(db, previous))
    draft = (
        db.get(PlanVersion, trip.draft_version_id) if trip.draft_version_id else None
    )
    row, token = chosen_base(db, trip, body.basis)
    if row.id != body.base_version_id or token != if_match:
        raise HTTPException(409, "REPLAN_BASE_CHANGED")
    if (
        draft is None
        or draft.status != "draft"
        or not same_plan(plan_input(db, draft), plan_input(db, row))
    ):
        raise HTTPException(409, "REPLAN_DRAFT_DIVERGED")
    sequence = draft.edit_sequence
    command = RemainingDayInput.model_validate(
        body.model_dump(exclude={"preview_changes"})
    )
    checked = preview_remaining_day(
        trip_id, command, request, response, if_match, user, db
    )["data"]
    changes = [c.model_dump(mode="json") for c in body.preview_changes]
    if changes != checked["changes"]:
        raise HTTPException(409, "REPLAN_PREVIEW_CHANGED")
    if checked["unchanged"]:
        raise HTTPException(409, "REPLAN_NO_CHANGES")
    db.refresh(draft)
    if draft.edit_sequence != sequence or trip.draft_version_id != draft.id:
        raise HTTPException(409, "REPLAN_BASE_CHANGED")
    candidate = apply_remaining(plan_input(db, draft), changes, checked["skipped"])
    report = validate_plan(candidate)
    report["issues"].append(REMAINING_ISSUE)
    report["remaining_day"] = dict(
        operation="remaining_day",
        request=command.model_dump(mode="json"),
        save_request=fingerprint,
        base_etag=token,
        changes=changes,
        skipped=checked["skipped"],
        day=body.local_day_offset + 1,
        destination=next(
            s.name for s in candidate.stops if s.client_id == str(body.stop_id)
        ),
        summary="Flexible start times only. Starting context is retained with this proposal; route facts are not saved."
        if not checked["skipped"] and not body.rest_minutes
        else "A lighter remaining day you chose: "
        + (f"rest {body.rest_minutes} minutes first; " if body.rest_minutes else "")
        + (
            f"skip {len(checked['skipped'])} flexible "
            + ("activity" if len(checked["skipped"]) == 1 else "activities")
            + "; "
            if checked["skipped"]
            else ""
        )
        + "later flexible start times follow. Route facts are not saved.",
    )
    extra = fatigue_issue(report["remaining_day"])
    if extra:
        report["issues"].append(extra)
    proposal = persist_candidate(db, trip, draft, candidate, idempotency_key, report)
    return wrap(request, proposal_view(db, proposal))
