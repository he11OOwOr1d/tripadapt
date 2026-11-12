"""Authenticated, on-demand Google details. Only IDs may enter saved plans."""

from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from pydantic import Field
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.trips import Envelope, router, wrap
from app.persistence.models import AppUser, DiscoveredPlace, PlaceReference
from app.planning.opening_hours import check_hours
from app.providers.activities import distance
from app.providers.google_places import (
    GOOGLE_ID,
    GoogleFailure,
    GoogleMatch,
    GooglePlaces,
)
from app.trips.schemas import StrictModel

google_places = GooglePlaces()


class MatchInput(StrictModel):
    source_place_id: UUID


class CheckInput(MatchInput):
    google_place_id: str = Field(pattern=GOOGLE_ID)
    visit_date: date | None = None
    start: time
    duration_minutes: int = Field(gt=0, le=1440)


class GoogleCheck(StrictModel):
    place: GoogleMatch
    retrieved_at: datetime
    status: str
    explanation: str
    hours: list[str]
    hours_basis: str
    price_level: str | None = None
    price_range: dict | None = None
    attributions: list[str]


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


@router.post("/google-places/matches", response_model=Envelope[list[GoogleMatch]])
def google_matches(
    body: MatchInput,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    source = source_place(db, body.source_place_id)
    try:
        results = google_places.matches(
            str(user.id),
            source.payload["name"],
            source.payload["latitude"],
            source.payload["longitude"],
        )
        # Location bias is not a boundary. Never silently match a distant namesake.
        return wrap(
            request,
            [
                p
                for p in results
                if distance(
                    source.payload["latitude"],
                    source.payload["longitude"],
                    p.latitude,
                    p.longitude,
                )
                <= 1000
            ],
        )
    except GoogleFailure as error:
        fail(error)


@router.post("/google-places/check", response_model=Envelope[GoogleCheck])
def google_check(
    body: CheckInput,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    source = source_place(db, body.source_place_id)
    location = db.get(PlaceReference, source.destination_reference_id)
    try:
        data = google_places.details(str(user.id), body.google_place_id)
        place = GoogleMatch(
            id=data["id"],
            name=data["displayName"]["text"],
            address=data.get("formattedAddress", ""),
            latitude=data["location"]["latitude"],
            longitude=data["location"]["longitude"],
        )
        if (
            place.id != body.google_place_id
            or distance(
                source.payload["latitude"],
                source.payload["longitude"],
                place.latitude,
                place.longitude,
            )
            > 1000
        ):
            raise HTTPException(422, "GOOGLE_PLACE_LOCATION_MISMATCH")
        stamp = datetime.now(timezone.utc)
        status, explanation = check_hours(
            data,
            body.visit_date,
            body.start,
            body.duration_minutes,
            location.payload["timezone"],
            stamp,
        )
        hours = data.get("currentOpeningHours") or data.get("regularOpeningHours") or {}
        return wrap(
            request,
            GoogleCheck(
                place=place,
                retrieved_at=stamp,
                status=status,
                explanation=explanation,
                hours=[
                    line
                    for line in hours.get("weekdayDescriptions", [])[:7]
                    if isinstance(line, str)
                ][:7],
                hours_basis="current"
                if data.get("currentOpeningHours")
                else "regular"
                if hours
                else "unavailable",
                price_level=data.get("priceLevel"),
                price_range=data.get("priceRange"),
                attributions=[
                    a["provider"]
                    for a in data.get("attributions", [])[:10]
                    if isinstance(a, dict) and isinstance(a.get("provider"), str)
                ],
            ),
        )
    except GoogleFailure as error:
        fail(error)
    except (KeyError, TypeError, ValueError):
        raise HTTPException(503, "GOOGLE_PLACES_UNAVAILABLE") from None
