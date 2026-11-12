"""Transient route estimates; no itinerary mutation or Google payload retention."""

import math
import re
from datetime import datetime, time, timezone
from typing import Literal
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from pydantic import Field
from sqlalchemy.orm import Session

from app.api.google_places import fail, google_places, source_place
from app.api.identity import current_user, session
from app.api.trips import Envelope, router, wrap
from app.persistence.models import AppUser
from app.providers.google_places import GoogleFailure
from app.trips.schemas import StrictModel


class JourneyInput(StrictModel):
    origin_place_id: UUID
    destination_place_id: UUID
    mode: Literal["WALK", "DRIVE"]
    origin_start: time
    origin_minutes: int = Field(gt=0, le=1440)
    destination_start: time
    buffer_minutes: int = Field(ge=0, le=120, default=10)


class JourneyCheck(StrictModel):
    retrieved_at: datetime
    mode: Literal["WALK", "DRIVE"]
    travel_minutes: int
    distance_meters: int
    gap_minutes: float
    buffer_minutes: int
    spare_minutes: float
    status: Literal["fits_estimate", "shortfall"]
    warnings: list[str]


def route_estimate(data):
    """Reject missing/malformed evidence instead of returning a zero journey."""
    try:
        route = data["routes"][0]
        raw = route["duration"]
        if not isinstance(raw, str) or not re.fullmatch(r"\d+(?:\.\d{1,9})?s", raw):
            raise ValueError()
        seconds = float(raw[:-1])
        meters = route["distanceMeters"]
        if (
            not math.isfinite(seconds)
            or seconds > 604800
            or type(meters) is not int
            or not 0 <= meters <= 20000000
        ):
            raise ValueError()
        warnings = route.get("warnings", [])
        if not isinstance(warnings, list) or any(
            not isinstance(w, str) for w in warnings
        ):
            raise ValueError()
        return math.ceil(seconds / 60), meters, warnings[:10]
    except (KeyError, IndexError, TypeError, ValueError, OverflowError):
        raise GoogleFailure("GOOGLE_ROUTES_UNAVAILABLE") from None


def clock_minutes(value):
    return (
        value.hour * 60
        + value.minute
        + value.second / 60
        + value.microsecond / 60000000
    )


@router.post("/journeys/check", response_model=Envelope[JourneyCheck])
def check_journey(
    body: JourneyInput,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    origin = source_place(db, body.origin_place_id)
    destination = source_place(db, body.destination_place_id)
    if origin.destination_reference_id != destination.destination_reference_id:
        raise HTTPException(422, "JOURNEY_DIFFERENT_DESTINATIONS")
    if body.origin_start.tzinfo or body.destination_start.tzinfo:
        raise HTTPException(422, "JOURNEY_LOCAL_TIME_REQUIRED")

    def waypoint(place):
        return {
            "location": {
                "latLng": {
                    "latitude": place.payload["latitude"],
                    "longitude": place.payload["longitude"],
                }
            }
        }

    payload = {
        "origin": waypoint(origin),
        "destination": waypoint(destination),
        "travelMode": body.mode,
        "computeAlternativeRoutes": False,
        "languageCode": "en",
    }
    if body.mode == "DRIVE":
        payload["routingPreference"] = "TRAFFIC_UNAWARE"
    try:
        data = google_places.request(
            str(user.id),
            "",
            "routes.duration,routes.distanceMeters,routes.warnings",
            payload,
            routes=True,
        )
        minutes, meters, warnings = route_estimate(data)
    except GoogleFailure as error:
        fail(
            GoogleFailure(
                error.code.replace("GOOGLE_PLACES_", "GOOGLE_ROUTES_"), error.status
            )
        )
    gap = (
        clock_minutes(body.destination_start)
        - clock_minutes(body.origin_start)
        - body.origin_minutes
    )
    spare = gap - minutes - body.buffer_minutes
    return wrap(
        request,
        JourneyCheck(
            retrieved_at=datetime.now(timezone.utc),
            mode=body.mode,
            travel_minutes=minutes,
            distance_meters=meters,
            gap_minutes=gap,
            buffer_minutes=body.buffer_minutes,
            spare_minutes=spare,
            status="fits_estimate" if spare >= 0 else "shortfall",
            warnings=warnings,
        ),
    )
