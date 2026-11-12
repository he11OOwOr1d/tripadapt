"""Transient provider guard for one saved time-change command. Never persist facts."""

import json
from datetime import date, timedelta
from typing import Literal

from fastapi import HTTPException
from pydantic import Field

from app.providers.google_places import GOOGLE_ID
from app.trips.schemas import StrictModel


class LiveAcceptance(StrictModel):
    google_place_id: str = Field(pattern=GOOGLE_ID)
    visit_date: date
    mode: Literal["WALK", "DRIVE"] = "WALK"
    buffer_minutes: int = Field(ge=0, le=120, default=10)


def planned_visit_date(plan, metadata):
    if plan.date_mode != "exact" or not plan.start_date:
        return None
    scope = metadata["scope"]
    offset = 0
    previous = "origin:" + (plan.origin.label if plan.origin else "")
    for stop in plan.stops:
        key = json.dumps(
            [previous, stop.client_id], separators=(",", ":"), ensure_ascii=False
        )
        leg = plan.preferences.travel_preferences.get(key)
        offset += leg.overnight if leg else 0
        if stop.client_id == scope["stop_logical_id"]:
            return plan.start_date + timedelta(days=offset + scope["local_day_offset"])
        offset += stop.desired_nights or 0
        previous = stop.client_id
    raise ValueError("Missing stop")


def recheck_move(db, user, request, plan, metadata, checks):
    # Import at execution time to retain the existing API/provider boundaries.
    from app.api.google_places import CheckInput, google_check
    from app.api.journeys import JourneyInput, check_journey

    proposed_date = planned_visit_date(plan, metadata)
    if proposed_date and proposed_date != checks.visit_date:
        raise HTTPException(422, "LIVE_CHECK_DATE_MISMATCH")
    target = next(
        a
        for a in plan.activities
        if str(a.logical_id) == metadata["command"]["activity_id"]
    )
    if target.place_id is None:
        raise HTTPException(409, "LIVE_CHECK_LOCATION_REQUIRED")
    day = sorted(
        (
            a
            for a in plan.activities
            if a.stop_logical_id == target.stop_logical_id
            and a.local_day_offset == target.local_day_offset
        ),
        key=lambda a: (a.local_start_time, str(a.logical_id)),
    )
    index = next(i for i, a in enumerate(day) if a.logical_id == target.logical_id)
    legs = ([] if index == 0 else [(day[index - 1], target)]) + (
        [] if index == len(day) - 1 else [(target, day[index + 1])]
    )
    if any(
        origin.place_id is None or destination.place_id is None
        for origin, destination in legs
    ):
        raise HTTPException(409, "LIVE_CHECK_LOCATION_REQUIRED")
    hours = google_check(
        CheckInput(
            source_place_id=target.place_id,
            google_place_id=checks.google_place_id,
            visit_date=checks.visit_date,
            start=target.local_start_time,
            duration_minutes=target.duration_minutes,
        ),
        request,
        user,
        db,
    )["data"]
    if hours.status != "fits_reported_hours":
        raise HTTPException(409, "LIVE_CHECK_HOURS_NOT_CONFIRMED")
    for origin, destination in legs:
        if origin.place_id is None or destination.place_id is None:
            raise HTTPException(409, "LIVE_CHECK_LOCATION_REQUIRED")
        route = check_journey(
            JourneyInput(
                origin_place_id=origin.place_id,
                destination_place_id=destination.place_id,
                mode=checks.mode,
                origin_start=origin.local_start_time,
                origin_minutes=origin.duration_minutes,
                destination_start=destination.local_start_time,
                buffer_minutes=checks.buffer_minutes,
            ),
            request,
            user,
            db,
        )["data"]
        if route.spare_minutes < 0:
            raise HTTPException(409, "LIVE_CHECK_ROUTE_SHORTFALL")
        if route.warnings:
            raise HTTPException(409, "LIVE_CHECK_ROUTE_WARNING")
