"""Transient acceptance guards and safe failure context. Never persist facts."""

import json
from datetime import date, timedelta
from typing import Literal
from uuid import UUID

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
    proposed_date = planned_visit_date(plan, metadata)
    if proposed_date and proposed_date != checks.visit_date:
        raise HTTPException(422, "LIVE_CHECK_DATE_MISMATCH")
    target = next(
        a
        for a in plan.activities
        if str(a.logical_id) == metadata["command"]["activity_id"]
    )
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
    recheck_visits_and_journeys(
        db,
        user,
        request,
        [target],
        legs,
        {target.logical_id: checks.google_place_id},
        checks,
    )


class DelayLiveAcceptance(StrictModel):
    visit_date: date
    mode: Literal["WALK", "DRIVE"] = "WALK"
    buffer_minutes: int = Field(ge=0, le=120, default=10)
    listings: dict[UUID, str] = Field(min_length=1, max_length=6)


def delay_check_scope(plan, metadata):
    """Derive affected visits/edges from the command, never client-supplied IDs."""
    target = next(
        a
        for a in plan.activities
        if str(a.logical_id) == metadata["command"]["activity_id"]
    )
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
    return (
        day[index:],
        list(zip(day[max(0, index - 1) :], day[max(0, index - 1) + 1 :])),
        {
            "scope": {
                "stop_logical_id": str(target.stop_logical_id),
                "local_day_offset": target.local_day_offset,
            }
        },
    )


class DayCheckDiagnostic(StrictModel):
    kind: Literal["visit", "journey"]
    reason: Literal[
        "location_missing",
        "listing_mismatch",
        "closed",
        "outside_hours",
        "hours_unknown",
        "outside_coverage",
        "shortfall",
        "route_warning",
        "provider_error",
    ]
    activity_id: UUID
    from_activity_id: UUID | None = None


class DayCheckProblem(StrictModel):
    type: str
    title: str
    status: int
    code: str
    detail: str
    request_id: str
    issues: list[dict] = []
    day_check: DayCheckDiagnostic | None = None


class DayCheckFailure(HTTPException):
    def __init__(self, status, code, diagnostic, headers=None):
        super().__init__(status, code, headers=headers)
        self.diagnostic = diagnostic


def day_check_failure(code, activity, reason, origin=None, status=409, headers=None):
    raise DayCheckFailure(
        status,
        code,
        DayCheckDiagnostic(
            kind="journey" if origin else "visit",
            reason=reason,
            activity_id=activity.logical_id,
            from_activity_id=origin.logical_id if origin else None,
        ),
        headers,
    )


def recheck_delay(db, user, request, plan, metadata, checks):
    import re

    visits, legs, scope = delay_check_scope(plan, metadata)
    if len(visits) > 6:
        raise HTTPException(422, "LIVE_CHECK_DAY_LIMIT")
    if set(checks.listings) != {a.logical_id for a in visits} or any(
        not re.fullmatch(GOOGLE_ID, ident) for ident in checks.listings.values()
    ):
        raise HTTPException(422, "LIVE_CHECK_LISTINGS_REQUIRED")
    expected = planned_visit_date(plan, scope)
    if expected and expected != checks.visit_date:
        raise HTTPException(422, "LIVE_CHECK_DATE_MISMATCH")
    recheck_visits_and_journeys(
        db, user, request, visits, legs, checks.listings, checks
    )


def recheck_visits_and_journeys(db, user, request, visits, legs, listings, checks):
    """One evidence policy for single changes and day adjustments; facts stay transient."""
    from app.api.google_places import CheckInput, google_check
    from app.api.journeys import JourneyInput, check_journey

    for visit in visits:
        if visit.place_id is None:
            day_check_failure("LIVE_CHECK_LOCATION_REQUIRED", visit, "location_missing")
    for origin, destination in legs:
        if origin.place_id is None or destination.place_id is None:
            day_check_failure(
                "LIVE_CHECK_LOCATION_REQUIRED", destination, "location_missing", origin
            )
    for visit in visits:
        try:
            hours = google_check(
                CheckInput(
                    source_place_id=visit.place_id,
                    google_place_id=listings[visit.logical_id],
                    visit_date=checks.visit_date,
                    start=visit.local_start_time,
                    duration_minutes=visit.duration_minutes,
                ),
                request,
                user,
                db,
            )["data"]
        except HTTPException as error:
            # Provider bodies/messages never become diagnostic content.
            mismatch = error.detail == "GOOGLE_PLACE_LOCATION_MISMATCH"
            code = (
                error.detail
                if error.detail
                in {
                    "GOOGLE_PLACE_LOCATION_MISMATCH",
                    "GOOGLE_PLACE_NOT_FOUND",
                    "GOOGLE_PLACES_UNAVAILABLE",
                    "GOOGLE_PLACES_ACCESS_DENIED",
                    "GOOGLE_PLACES_NOT_CONFIGURED",
                    "GOOGLE_PLACES_RATE_LIMITED",
                    "GOOGLE_PLACES_BUSY",
                }
                else "GOOGLE_PLACES_UNAVAILABLE"
            )
            day_check_failure(
                code,
                visit,
                "listing_mismatch" if mismatch else "provider_error",
                status=error.status_code,
                headers=error.headers,
            )
        if hours.status != "fits_reported_hours":
            reason = {
                "reported_closed": "closed",
                "outside_reported_hours": "outside_hours",
                "outside_coverage": "outside_coverage",
            }.get(hours.status, "hours_unknown")
            day_check_failure("LIVE_CHECK_HOURS_NOT_CONFIRMED", visit, reason)
    for origin, destination in legs:
        try:
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
        except HTTPException as error:
            code = (
                error.detail
                if error.detail
                in {
                    "ROUTES_UNAVAILABLE",
                    "ROUTES_ACCESS_DENIED",
                    "ROUTES_NOT_CONFIGURED",
                    "ROUTES_RATE_LIMITED",
                    "ROUTES_BUSY",
                    "JOURNEY_DIFFERENT_DESTINATIONS",
                }
                else "ROUTES_UNAVAILABLE"
            )
            day_check_failure(
                code,
                destination,
                "provider_error",
                origin,
                status=error.status_code,
                headers=error.headers,
            )
        if route.spare_minutes < 0:
            day_check_failure(
                "LIVE_CHECK_ROUTE_SHORTFALL", destination, "shortfall", origin
            )
        if route.warnings:
            day_check_failure(
                "LIVE_CHECK_ROUTE_WARNING", destination, "route_warning", origin
            )
