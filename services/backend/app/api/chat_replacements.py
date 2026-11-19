"""Owned, draft-bound research for an existing conversational replacement request."""

from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy.orm import Session

from app.api import places, weather
from app.api.identity import current_user, session
from app.api.proposals import plan_input
from app.api.trips import Envelope, owned, router, wrap
from app.discovery.activities import PlaceDetail, detail
from app.persistence.models import (
    AppUser,
    ConversationTurn,
    DiscoveredPlace,
    PlaceReference,
    PlanningJob,
    PlanVersion,
)
from app.planning.chat_options import rank_replacements
from app.planning.weather_handoff import validate_handoff
from app.planning.weather_revision import (
    WeatherContext,
    check_date,
    validate_weather_context,
)
from app.providers.weather import WeatherFailure
from app.trips.schemas import StrictModel


class ReplacementLookup(StrictModel):
    visit_date: date
    category: Literal["museum", "gallery"]


class ReplacementOption(StrictModel):
    place: PlaceDetail
    distance_meters: int = Field(ge=0)
    distance_basis: Literal["activity_location", "destination_centre"]


class ReplacementTarget(StrictModel):
    activity_id: UUID
    label: str
    start: str
    duration_minutes: int


class ReplacementOptions(StrictModel):
    base_etag: str
    target: ReplacementTarget
    category: Literal["museum", "gallery"]
    forecast: weather.WeatherView
    options: list[ReplacementOption] = Field(max_length=3)
    eligible_count: int = Field(ge=0)
    notice: str | None = None


@router.post(
    "/trips/{trip_id}/messages/{turn_id}/replacement-options",
    response_model=Envelope[ReplacementOptions],
)
def replacement_options(
    trip_id: UUID,
    turn_id: UUID,
    body: ReplacementLookup,
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
    turn = db.get(ConversationTurn, turn_id)
    if turn is None or turn.trip_id != trip.id:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    job = db.get(PlanningJob, turn.job_id)
    action = (job.result_metadata or {}).get("weather_handoff")
    if turn.kind != "weather_handoff" or job.status != "succeeded" or action is None:
        raise HTTPException(409, "WEATHER_REQUEST_UNAVAILABLE")
    draft = (
        db.get(PlanVersion, trip.draft_version_id) if trip.draft_version_id else None
    )
    if draft is None or if_match != f'"draft:{draft.id}:{draft.edit_sequence}"':
        raise HTTPException(412, "PRECONDITION_FAILED")
    if trip.lifecycle != "planning":
        raise HTTPException(409, "WEATHER_PLANNING_ONLY")
    plan = plan_input(db, draft)
    scope = job.input["request"]["scope"]
    try:
        action = validate_handoff(plan, scope, action, if_match)
    except (ValueError, KeyError, TypeError):
        raise HTTPException(409, "WEATHER_REQUEST_UNAVAILABLE") from None
    try:
        date_basis = check_date(plan, scope, body.visit_date)
    except ValueError:
        raise HTTPException(409, "WEATHER_DATE_MISMATCH") from None
    target = next(a for a in plan.activities if a.logical_id == action.activity_id)
    stop = next(s for s in plan.stops if s.client_id == scope["stop_logical_id"])
    reference = db.get(PlaceReference, stop.place_reference_id)
    if reference is None or reference.payload["timezone"] != stop.timezone:
        raise HTTPException(409, "WEATHER_LOCATION_REQUIRED")
    try:
        outlook = weather.weather_view(
            reference,
            body.visit_date,
            weather.weather_provider,
            datetime.now(timezone.utc),
        )
    except WeatherFailure as error:
        raise HTTPException(
            error.status,
            error.code,
            headers={"Retry-After": "60"} if error.status == 429 else None,
        ) from None
    result = ReplacementOptions(
        base_etag=if_match,
        category=body.category,
        forecast=outlook,
        options=[],
        eligible_count=0,
        target=ReplacementTarget(
            activity_id=target.logical_id,
            label=target.user_label,
            start=target.local_start_time.strftime("%H:%M"),
            duration_minutes=target.duration_minutes,
        ),
    )
    if outlook.status == "forecast":
        try:
            validate_weather_context(
                plan,
                scope,
                WeatherContext(
                    source="Open-Meteo",
                    destination_reference_id=reference.id,
                    timezone=outlook.timezone,
                    visit_date=body.visit_date,
                    date_basis=date_basis,
                    retrieved_at=outlook.retrieved_at,
                    cached=outlook.cached,
                    day=outlook.day,
                ),
                datetime.now(timezone.utc),
            )
        except ValueError:
            raise HTTPException(409, "WEATHER_REVIEW_EXPIRED") from None
        page = places.search_places(request, response, reference.id, body.category, db)[
            "data"
        ]
        current = db.get(DiscoveredPlace, target.place_id) if target.place_id else None
        ranked, count = rank_replacements(
            page.results,
            detail(current) if current else None,
            reference,
            body.category,
            datetime.now(timezone.utc),
        )
        result.options = [ReplacementOption(**option) for option in ranked]
        result.eligible_count = count
        result.notice = page.notice
    # Research may span several seconds. Do not return choices against newer edits.
    db.refresh(draft)
    db.refresh(trip)
    if (
        trip.draft_version_id != draft.id
        or if_match != f'"draft:{draft.id}:{draft.edit_sequence}"'
    ):
        raise HTTPException(409, "WEATHER_REQUEST_UNAVAILABLE")
    if trip.lifecycle != "planning":
        raise HTTPException(409, "WEATHER_PLANNING_ONLY")
    return wrap(request, result)
