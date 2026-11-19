"""Owned immutable proposals based on server-retrieved forecast context."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import weather
from app.api.identity import current_user, session
from app.api.proposals import ProposalView, persist_candidate, plan_input, proposal_view
from app.api.trips import Envelope, owned, router, wrap
from app.persistence.models import AppUser, PlaceReference, PlanProposal, PlanVersion
from app.planning.validation import validate_plan
from app.planning.weather_revision import (
    WeatherChangeInput,
    WeatherContext,
    check_date,
    validate_weather_context,
    weather_candidate,
    weather_issue,
)
from app.providers.weather import WeatherFailure


@router.post(
    "/trips/{trip_id}/proposals/weather-change",
    status_code=201,
    response_model=Envelope[ProposalView],
)
def propose_weather_change(
    trip_id: UUID,
    body: WeatherChangeInput,
    request: Request,
    if_match: str | None = Header(None),
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=True)
    if if_match is None or idempotency_key is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    fingerprint = body.model_dump(mode="json", exclude_none=True)
    previous = db.scalar(
        select(PlanProposal).where(
            PlanProposal.trip_id == trip.id, PlanProposal.submit_key == idempotency_key
        )
    )
    if previous:
        candidate = db.get(PlanVersion, previous.candidate_version_id)
        if (
            candidate.validation_report.get("weather_revision", {}).get("request")
            != fingerprint
            or if_match
            != f'"draft:{previous.base_draft_id}:{previous.base_edit_sequence}"'
        ):
            raise HTTPException(409, "IDEMPOTENCY_KEY_REUSED")
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
    if trip.lifecycle != "planning":
        raise HTTPException(409, "WEATHER_PLANNING_ONLY")
    base = plan_input(db, draft)
    target = next(
        (a for a in base.activities if a.logical_id == body.activity_id), None
    )
    if target is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    scope = {
        "stop_logical_id": str(target.stop_logical_id),
        "local_day_offset": target.local_day_offset,
    }
    stop = next(s for s in base.stops if s.client_id == scope["stop_logical_id"])
    reference = (
        db.get(PlaceReference, stop.place_reference_id)
        if stop.place_reference_id
        else None
    )
    if reference is None or reference.payload["timezone"] != stop.timezone:
        raise HTTPException(409, "WEATHER_LOCATION_REQUIRED")
    try:
        date_basis = check_date(base, scope, body.visit_date)
        candidate, metadata = weather_candidate(
            db, base, scope, body, datetime.now(timezone.utc)
        )
    except ValueError as error:
        raise HTTPException(
            409,
            str(error) if str(error).startswith("WEATHER_") else "PLAN_CONFLICT",
        ) from None
    now = datetime.now(timezone.utc)
    try:
        outlook = weather.weather_view(
            reference, body.visit_date, weather.weather_provider, now
        )
    except WeatherFailure as error:
        raise HTTPException(
            error.status,
            error.code,
            headers={"Retry-After": "60"} if error.status == 429 else None,
        ) from None
    if outlook.status != "forecast":
        raise HTTPException(409, "WEATHER_FORECAST_REQUIRED")
    context = WeatherContext(
        source="Open-Meteo",
        destination_reference_id=reference.id,
        timezone=outlook.timezone,
        visit_date=body.visit_date,
        date_basis=date_basis,
        retrieved_at=outlook.retrieved_at,
        cached=outlook.cached,
        day=outlook.day,
    )
    try:
        validate_weather_context(base, scope, context, datetime.now(timezone.utc))
    except ValueError as error:
        raise HTTPException(409, str(error)) from None
    metadata.update(
        request=fingerprint, scope=scope, weather=context.model_dump(mode="json")
    )
    report = validate_plan(candidate)
    report["issues"].append(weather_issue(metadata))
    report["weather_revision"] = metadata
    proposal = persist_candidate(db, trip, draft, candidate, idempotency_key, report)
    return wrap(request, proposal_view(db, proposal))
