"""Server-owned map evidence for bounded AI additions; never silently sample."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select

from app.agents.groq_provider import PlanningFailure
from app.config import settings
from app.discovery.activities import retain
from app.persistence.models import DiscoveredPlace, PlaceReference
from app.providers.activities import DiscoveryFailure

BREAKS = [
    {"id": "meal", "label": "Meal break", "kind": "meal", "minutes": 60},
    {"id": "rest", "label": "Rest break", "kind": "rest", "minutes": 30},
    {"id": "free", "label": "Free time", "kind": "free_time", "minutes": 60},
]
PLACE_ISSUE = {
    "id": "AI_MAPPED_PLACES:plan",
    "code": "AI_MAPPED_PLACES",
    "activity_id": None,
    "blocking": False,
    "acknowledgeable": True,
    "detail": "AI place additions use attributed map records. Visit durations and break blocks are estimates. Opening hours, admission, availability, weather and journey times have not been checked; review the original sources before accepting.",
}


def catalog_from_ids(db, stop, ids):
    if len(ids) > 12 or len(set(ids)) != len(ids):
        raise ValueError("Invalid evidence budget")
    rows = {
        str(row.id): row
        for row in db.scalars(
            select(DiscoveredPlace).where(
                DiscoveredPlace.id.in_([UUID(i) for i in ids])
            )
        )
    }
    catalog = []
    for ident in ids:
        row = rows.get(ident)
        if row is None or row.destination_reference_id != stop.place_reference_id:
            raise ValueError("Evidence destination mismatch")
        stamp = datetime.fromisoformat(row.payload["retrieved_at"])
        if stamp < datetime.now(timezone.utc) - timedelta(
            hours=24
        ) or stamp > datetime.now(timezone.utc) + timedelta(minutes=1):
            raise ValueError("Place evidence needs refresh")
        catalog.append(
            {
                "id": f"place:{ident}",
                "place_id": ident,
                "label": row.payload["name"],
                "kind": "custom",
                "minutes": 60,
                "source": row.payload["source"],
                "retrieved_at": row.payload["retrieved_at"],
                "external_id": row.payload["external_id"],
                "duration_status": "estimated",
            }
        )
    return catalog + [dict(block) for block in BREAKS]


def gather_places(db, stop, candidate_ids, progress):
    from app.api.places import activity_discovery

    if not settings.activity_search_enabled:
        raise PlanningFailure("ACTIVITY_SEARCH_DISABLED")
    selected = set(candidate_ids or ["culture", "walk", "meal", "rest", "free"])
    categories = (["museum"] if "culture" in selected else []) + (
        ["park"] if "walk" in selected else []
    )
    ids = []
    if categories:
        location = (
            db.get(PlaceReference, stop.place_reference_id)
            if stop.place_reference_id
            else None
        )
        if location is None:
            raise PlanningFailure("AI_LOCATION_REQUIRED")
        for category in categories:
            progress("Looking up real places")
            try:
                page = activity_discovery.search(
                    location.payload["latitude"],
                    location.payload["longitude"],
                    category,
                )
            except DiscoveryFailure as error:
                raise PlanningFailure(error.code) from None
            retained = retain(db, page, location.id)
            ids.extend(str(p.id) for p in retained.results[:6])
        if not ids:
            raise PlanningFailure("AI_NO_PLACE_EVIDENCE")
    catalog = catalog_from_ids(db, stop, ids)
    return [c for c in catalog if c.get("place_id") or c["id"] in selected], ids
