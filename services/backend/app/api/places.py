"""Public explicit research; no private trip or device location sent upstream."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.identity import session
from app.api.trips import Envelope, router, wrap
from app.config import settings
from app.discovery.activities import (
    PlaceDetail,
    PlacePage,
    detail,
    recent_discoveries,
    retain,
)
from app.persistence.models import DiscoveredPlace, PlaceReference
from app.providers.activities import ActivityDiscovery, Category, DiscoveryFailure

activity_discovery = ActivityDiscovery()


@router.get("/places/search", response_model=Envelope[PlacePage])
def search_places(
    request: Request,
    response: Response,
    destination_reference_id: UUID,
    category: Category = "museum",
    db: Session = Depends(session),
):
    response.headers["Cache-Control"] = "private, no-store"
    if not settings.activity_search_enabled:
        raise HTTPException(503, "ACTIVITY_SEARCH_DISABLED")
    location = db.get(PlaceReference, destination_reference_id)
    if location is None:
        raise HTTPException(404, "DESTINATION_REFERENCE_NOT_FOUND")
    try:
        page = activity_discovery.search(
            location.payload["latitude"], location.payload["longitude"], category
        )
        return wrap(request, retain(db, page, location.id))
    except DiscoveryFailure as failure:
        if failure.status == 503:
            retained = recent_discoveries(
                db, location.id, category, datetime.now(timezone.utc)
            )
            if retained is not None:
                return wrap(request, retained)
        raise HTTPException(
            failure.status,
            failure.code,
            headers={"Retry-After": "60"} if failure.status == 429 else None,
        ) from None


@router.get("/places/{place_id}", response_model=Envelope[PlaceDetail])
def place_detail(
    place_id: UUID, request: Request, response: Response, db: Session = Depends(session)
):
    response.headers["Cache-Control"] = "private, no-store"
    place = db.get(DiscoveredPlace, place_id)
    if place is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    return wrap(request, detail(place))
