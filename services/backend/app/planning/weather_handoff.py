"""A read-only, draft-bound pointer into the existing weather replacement chooser."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.planning.live_acceptance import planned_visit_date
from app.trips.schemas import StrictModel


class ReplacementFocus(StrictModel):
    activity_id: str
    category: Literal["museum", "gallery"]
    visit_date: str


class WeatherHandoff(StrictModel):
    type: Literal["weather_replacement"] = "weather_replacement"
    activity_id: UUID
    stop_id: UUID
    local_day_offset: int = Field(ge=0)
    category: Literal["museum", "gallery"]
    visit_date: date | None
    base_etag: str = Field(pattern=r'^"draft:[a-f0-9-]+:\d+"$')


def replacement_target(plan, scope, activity_id):
    target = next(
        (a for a in plan.activities if str(a.logical_id) == activity_id), None
    )
    if (
        target is None
        or str(target.stop_logical_id) != scope["stop_logical_id"]
        or target.local_day_offset != scope["local_day_offset"]
    ):
        raise ValueError(
            "Choose one activity on the selected day. I’ll open its replacement chooser; nothing changes yet."
        )
    if target.fixed or target.booked or target.completed:
        raise ValueError(
            "That activity is fixed, booked or completed. Choose a flexible activity; no reservation will be changed."
        )
    peers = [
        a
        for a in plan.activities
        if a.stop_logical_id == target.stop_logical_id
        and a.local_day_offset == target.local_day_offset
        and a.user_label.strip().casefold() == target.user_label.strip().casefold()
    ]
    if len(peers) != 1:
        raise ValueError(
            "More than one activity has that name on this day. Give them distinct names in Plan, then ask again."
        )
    stop = next(s for s in plan.stops if s.client_id == scope["stop_logical_id"])
    if not stop.place_reference_id:
        raise ValueError(
            "Choose this destination’s map location in Explore nearby places first. I can then open real replacement choices."
        )
    return target, stop


def validate_handoff(plan, scope, action, etag):
    action = WeatherHandoff.model_validate(action)
    if (
        action.base_etag != etag
        or str(action.stop_id) != scope["stop_logical_id"]
        or action.local_day_offset != scope["local_day_offset"]
    ):
        raise ValueError("Stale weather handoff")
    replacement_target(plan, scope, str(action.activity_id))
    scheduled = planned_visit_date(plan, {"scope": scope})
    if scheduled and action.visit_date != scheduled:
        raise ValueError("Weather date mismatch")
    return action
