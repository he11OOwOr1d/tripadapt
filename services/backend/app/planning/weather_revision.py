"""Traveler-led removal with dated forecast context, never a weather safety verdict."""

from datetime import date, datetime, timedelta
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import model_validator

from app.discovery.activities import detail
from app.persistence.models import DiscoveredPlace
from app.planning.live_acceptance import planned_visit_date
from app.planning.removal import RemoveActivity, remove_activity, validate_removal
from app.planning.validation import same_plan, validate_plan
from app.providers.weather import WeatherDay
from app.trips.schemas import StrictModel

WEATHER_ISSUE = {
    "id": "WEATHER_REVIEW:plan",
    "code": "WEATHER_REVIEW",
    "activity_id": None,
    "blocking": False,
    "acknowledgeable": True,
    "detail": "You chose to leave this activity's time open after checking a daily forecast. This is not a weather safety verdict. Other times stay unchanged. Recheck affected travel; prices, tickets and reservations are unchanged and unverified.",
}


class WeatherChangeInput(StrictModel):
    activity_id: UUID
    visit_date: date
    intent: Literal["leave_time_open", "replace_place"]
    replacement_place_id: UUID | None = None

    @model_validator(mode="after")
    def replacement_intent(self):
        if (self.intent == "replace_place") != (self.replacement_place_id is not None):
            raise ValueError(
                "Replacement place is required only for replacement intent"
            )
        return self


class WeatherContext(StrictModel):
    source: Literal["Open-Meteo"]
    destination_reference_id: UUID
    timezone: str
    visit_date: date
    date_basis: Literal["trip_schedule", "check_only"]
    retrieved_at: datetime
    cached: bool
    day: WeatherDay


def check_date(base, scope, visit_date):
    scheduled = planned_visit_date(base, {"scope": scope})
    if scheduled and scheduled != visit_date:
        raise ValueError("WEATHER_DATE_MISMATCH")
    return "trip_schedule" if scheduled else "check_only"


def validate_weather_context(base, scope, context, now):
    stop = next(
        (s for s in base.stops if s.client_id == scope["stop_logical_id"]), None
    )
    if stop is None:
        raise ValueError("WEATHER_CONTEXT_MISMATCH")
    if (
        stop.place_reference_id != context.destination_reference_id
        or stop.timezone != context.timezone
        or context.day.date != context.visit_date
        or check_date(base, scope, context.visit_date) != context.date_basis
    ):
        raise ValueError("WEATHER_CONTEXT_MISMATCH")
    today = now.astimezone(ZoneInfo(context.timezone)).date()
    retrieved = context.retrieved_at
    if (
        retrieved.tzinfo is None
        or not timedelta(0) <= now - retrieved < timedelta(minutes=15)
        or not today <= context.visit_date <= today + timedelta(days=15)
    ):
        raise ValueError("WEATHER_REVIEW_EXPIRED")
    if not any(
        v is not None for k, v in context.day.model_dump().items() if k != "date"
    ):
        raise ValueError("WEATHER_CONTEXT_MISMATCH")


def weather_candidate(db, base, scope, body, now):
    candidate, metadata = remove_activity(
        base, scope, RemoveActivity(activity_id=str(body.activity_id))
    )
    if body.intent == "leave_time_open":
        return candidate, metadata
    stop = next(s for s in base.stops if s.client_id == scope["stop_logical_id"])
    row = db.get(DiscoveredPlace, body.replacement_place_id)
    if row is None or row.destination_reference_id != stop.place_reference_id:
        raise ValueError("WEATHER_REPLACEMENT_LOCATION")
    place = detail(row)
    if place.category not in ("museum", "gallery"):
        raise ValueError("WEATHER_REPLACEMENT_CATEGORY")
    if not timedelta(0) <= now - place.retrieved_at < timedelta(hours=24):
        raise ValueError("WEATHER_REPLACEMENT_EXPIRED")
    candidate = base.model_copy(deep=True)
    target = next(a for a in candidate.activities if a.logical_id == body.activity_id)
    previous = db.get(DiscoveredPlace, target.place_id) if target.place_id else None
    if previous and previous.payload["external_id"] == place.external_id:
        raise ValueError("WEATHER_REPLACEMENT_UNCHANGED")
    before = target.user_label
    target.user_label = place.name
    target.place_id = place.id
    target.kind = "custom"
    if any(i["blocking"] for i in validate_plan(candidate)["issues"]):
        raise ValueError("PLAN_CONFLICT")
    metadata.pop("removal")
    metadata.update(
        operation="replace_activity",
        command={
            "activity_id": str(body.activity_id),
            "replacement_place_id": str(place.id),
        },
        replacement={
            "before": before,
            "after": place.name,
            "day": target.local_day_offset + 1,
            "destination": stop.name,
            "start": target.local_start_time.strftime("%H:%M"),
            "duration_minutes": target.duration_minutes,
            "place_id": str(place.id),
        },
        summary="Only the selected activity's place changes. The time slot and all other activities stay unchanged. Indoor access, admission and availability are not confirmed.",
    )
    return candidate, metadata


def weather_issue(metadata):
    if metadata["request"]["intent"] == "leave_time_open":
        return WEATHER_ISSUE
    return {
        **WEATHER_ISSUE,
        "detail": "You chose a museum or gallery as a possible alternative, not a confirmed indoor venue. Only this place changes; its time slot stays the same. Acceptance is provisional unless you request fresh hours and adjacent-journey checks. Admission, shelter, prices and reservations remain unconfirmed.",
    }


def validate_weather_revision(base, candidate, metadata, now, db=None):
    body = WeatherChangeInput.model_validate(metadata["request"])
    context = WeatherContext.model_validate(metadata["weather"])
    if body.visit_date != context.visit_date:
        raise ValueError("WEATHER_CONTEXT_MISMATCH")
    if metadata["command"]["activity_id"] != str(body.activity_id):
        raise ValueError("WEATHER_CONTEXT_MISMATCH")
    validate_weather_context(base, metadata["scope"], context, now)
    if body.intent == "leave_time_open":
        validate_removal(base, candidate, metadata["scope"], metadata)
    else:
        expected, expected_metadata = weather_candidate(
            db, base, metadata["scope"], body, now
        )
        if metadata["command"] != expected_metadata["command"] or not same_plan(
            candidate, expected
        ):
            raise ValueError("Candidate exceeds the requested replacement")
