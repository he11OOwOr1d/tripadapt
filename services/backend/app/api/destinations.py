"""Public explicit location lookup; no account or trip data is required."""

from fastapi import Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.api.identity import session
from app.api.trips import Envelope, router, wrap
from app.config import settings
from app.discovery.references import ReferencedSearch, retain_search
from app.providers.geocoding import Geocoder, GeocodingFailure

geocoder = Geocoder()


@router.get("/destinations/search", response_model=Envelope[ReferencedSearch])
def search_destinations(
    request: Request,
    response: Response,
    q: str = Query(min_length=2, max_length=100),
    db: Session = Depends(session),
):
    response.headers["Cache-Control"] = "private, no-store"
    if not settings.place_search_enabled:
        raise HTTPException(503, "PLACE_SEARCH_DISABLED")
    query = " ".join(q.strip().split())
    if len(query) < 2 or any(ord(c) < 32 or ord(c) == 127 for c in q):
        raise HTTPException(422, "PLACE_QUERY_INVALID")
    try:
        return wrap(request, retain_search(db, geocoder.search(query)))
    except GeocodingFailure as error:
        if error.status == 429:
            response.headers["Retry-After"] = "60"
        raise HTTPException(
            error.status,
            error.code,
            headers={"Retry-After": "60"} if error.status == 429 else None,
        ) from None
