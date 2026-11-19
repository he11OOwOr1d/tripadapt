"""Helpers shared by on-demand provider checks (routes today, hours next)."""

from fastapi import HTTPException

from app.persistence.models import DiscoveredPlace
from app.providers.geoapify_checks import GeoapifyChecks

# One process-wide budget shared by every on-demand Geoapify check.
geoapify_checks = GeoapifyChecks()


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
