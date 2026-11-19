"""Authenticated, on-demand place checks. Provider facts are never saved."""

from datetime import date, datetime, time, timezone
from typing import Literal
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from pydantic import Field
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.trips import Envelope, router, wrap
from app.persistence.models import AppUser, DiscoveredPlace, PlaceReference
from app.planning.opening_hours import check_hours
from app.providers.activities import distance
from app.providers.geoapify_checks import CheckFailure, GeoapifyChecks
from app.trips.schemas import StrictModel

# One process-wide budget shared by every on-demand Geoapify check.
geoapify_checks = GeoapifyChecks()
SOURCE = "Geoapify / OpenStreetMap contributors"


def source_place(db, ident):
    source = db.get(DiscoveredPlace, ident)
    if source is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    return source


def fail(error):
    raise HTTPException(
        error.status,
        error.code,
        headers={"Retry-After": "60"} if error.status == 429 else None,
    ) from None


class HoursInput(StrictModel):
    source_place_id: UUID
    visit_date: date | None = None
    start: time
    duration_minutes: int = Field(gt=0, le=1440)


class HoursCheck(StrictModel):
    place_name: str
    retrieved_at: datetime
    status: str
    explanation: str
    hours: list[str]
    hours_basis: Literal["regular", "unavailable"]
    source: str = SOURCE


@router.post("/place-checks/hours", response_model=Envelope[HoursCheck])
def hours_check(
    body: HoursInput,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    source = source_place(db, body.source_place_id)
    location = db.get(PlaceReference, source.destination_reference_id)
    if location is None:
        raise HTTPException(404, "DESTINATION_REFERENCE_NOT_FOUND")
    try:
        place = geoapify_checks.place_hours(
            str(user.id), source.payload.get("external_id")
        )
    except CheckFailure as error:
        fail(error)
    # The retained ID must still describe the place the traveler selected.
    if (
        distance(
            source.payload["latitude"],
            source.payload["longitude"],
            place.latitude,
            place.longitude,
        )
        > 1000
    ):
        raise HTTPException(422, "PLACE_LOCATION_MISMATCH")
    stamp = datetime.now(timezone.utc)
    status, explanation = check_hours(
        place.opening_hours,
        body.visit_date,
        body.start,
        body.duration_minutes,
        location.payload["timezone"],
        stamp,
        place.country_code,
        (place.latitude, place.longitude),
    )
    rules = [
        rule.strip()[:160]
        for rule in (place.opening_hours or "").split(";")
        if rule.strip()
    ][:12]
    return wrap(
        request,
        HoursCheck(
            place_name=place.name or str(source.payload.get("name", "")),
            retrieved_at=stamp,
            status=status,
            explanation=explanation,
            hours=rules,
            hours_basis="regular" if rules else "unavailable",
        ),
    )
