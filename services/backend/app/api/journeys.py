"""Transient route estimates; no itinerary mutation or provider payload retention."""

import math
from datetime import datetime, time, timezone
from typing import Literal
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from pydantic import Field
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.place_checks import fail, geoapify_checks, source_place
from app.api.trips import Envelope, router, wrap
from app.persistence.models import AppUser, PlaceReference
from app.providers.geoapify_checks import CheckFailure
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


class StayJourneyInput(StrictModel):
    """From a traveler-recorded stay (a map point) to a retained place."""

    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    destination_place_id: UUID
    mode: Literal["WALK", "DRIVE"]
    destination_start: time
    buffer_minutes: int = Field(ge=0, le=120, default=10)


class StayJourneyCheck(StrictModel):
    retrieved_at: datetime
    mode: Literal["WALK", "DRIVE"]
    travel_minutes: int
    distance_meters: int
    buffer_minutes: int
    leave_by: str | None
    status: Literal["leave_by", "needs_earlier_start"]
    warnings: list[str]


class StayReturnInput(StrictModel):
    """From a retained place back to a traveler-recorded stay."""

    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    origin_place_id: UUID
    mode: Literal["WALK", "DRIVE"]
    origin_end: time


class StayReturnCheck(StrictModel):
    retrieved_at: datetime
    mode: Literal["WALK", "DRIVE"]
    travel_minutes: int
    distance_meters: int
    arrive_by: str | None
    status: Literal["arrive_by", "after_midnight"]
    warnings: list[str]


class IntercityInput(StrictModel):
    """Between two retained destination references; the server reads their coordinates."""

    from_reference_id: UUID
    to_reference_id: UUID


class IntercityCheck(StrictModel):
    retrieved_at: datetime
    mode: Literal["DRIVE"]
    travel_minutes: int
    distance_meters: int
    warnings: list[str]


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

    try:
        minutes, meters, warnings = geoapify_checks.route(
            str(user.id),
            body.mode,
            (origin.payload["latitude"], origin.payload["longitude"]),
            (destination.payload["latitude"], destination.payload["longitude"]),
        )
    except CheckFailure as error:
        fail(error)
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


@router.post("/journeys/from-stay", response_model=Envelope[StayJourneyCheck])
def check_journey_from_stay(
    body: StayJourneyInput,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    """Estimate the trip from the stay to a visit and the latest time to leave."""
    if body.latitude == 0 and body.longitude == 0:
        raise HTTPException(422, "STAY_LOCATION_INVALID")
    if body.destination_start.tzinfo:
        raise HTTPException(422, "JOURNEY_LOCAL_TIME_REQUIRED")
    destination = source_place(db, body.destination_place_id)
    try:
        minutes, meters, warnings = geoapify_checks.route(
            str(user.id),
            body.mode,
            (body.latitude, body.longitude),
            (destination.payload["latitude"], destination.payload["longitude"]),
        )
    except CheckFailure as error:
        fail(error)
    # Truncating the start leaves earlier, the safe side for a leave-by time; the
    # way back rounds the end up, the safe side for an arrival time.
    leave = int(clock_minutes(body.destination_start)) - minutes - body.buffer_minutes
    return wrap(
        request,
        StayJourneyCheck(
            retrieved_at=datetime.now(timezone.utc),
            mode=body.mode,
            travel_minutes=minutes,
            distance_meters=meters,
            buffer_minutes=body.buffer_minutes,
            leave_by=f"{leave // 60:02d}:{leave % 60:02d}" if leave >= 0 else None,
            status="leave_by" if leave >= 0 else "needs_earlier_start",
            warnings=warnings,
        ),
    )


@router.post("/journeys/to-stay", response_model=Envelope[StayReturnCheck])
def check_journey_to_stay(
    body: StayReturnInput,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    """Estimate the trip back to the stay and when the traveler would arrive."""
    if body.latitude == 0 and body.longitude == 0:
        raise HTTPException(422, "STAY_LOCATION_INVALID")
    if body.origin_end.tzinfo:
        raise HTTPException(422, "JOURNEY_LOCAL_TIME_REQUIRED")
    origin = source_place(db, body.origin_place_id)
    try:
        minutes, meters, warnings = geoapify_checks.route(
            str(user.id),
            body.mode,
            (origin.payload["latitude"], origin.payload["longitude"]),
            (body.latitude, body.longitude),
        )
    except CheckFailure as error:
        fail(error)
    arrive = math.ceil(clock_minutes(body.origin_end)) + minutes
    return wrap(
        request,
        StayReturnCheck(
            retrieved_at=datetime.now(timezone.utc),
            mode=body.mode,
            travel_minutes=minutes,
            distance_meters=meters,
            arrive_by=f"{arrive // 60:02d}:{arrive % 60:02d}"
            if arrive < 1440
            else None,
            status="arrive_by" if arrive < 1440 else "after_midnight",
            warnings=warnings,
        ),
    )


@router.post("/journeys/intercity", response_model=Envelope[IntercityCheck])
def check_intercity(
    body: IntercityInput,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    """A driving estimate between two destinations. No schedule, mode choice or booking."""
    if body.from_reference_id == body.to_reference_id:
        raise HTTPException(422, "JOURNEY_SAME_PLACE")
    places = []
    for ident in (body.from_reference_id, body.to_reference_id):
        reference = db.get(PlaceReference, ident)
        if reference is None:
            raise HTTPException(404, "RESOURCE_NOT_FOUND")
        places.append((reference.payload["latitude"], reference.payload["longitude"]))
    try:
        minutes, meters, warnings = geoapify_checks.route(
            str(user.id), "DRIVE", places[0], places[1]
        )
    except CheckFailure as error:
        fail(error)
    return wrap(
        request,
        IntercityCheck(
            retrieved_at=datetime.now(timezone.utc),
            mode="DRIVE",
            travel_minutes=minutes,
            distance_meters=meters,
            warnings=warnings,
        ),
    )
