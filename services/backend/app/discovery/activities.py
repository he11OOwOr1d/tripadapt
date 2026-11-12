"""Retain attributed discovery snapshots independently of itinerary timing."""

from datetime import datetime
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.persistence.models import DiscoveredPlace
from app.providers.activities import ActivityPlace, ActivitySearch


class PlaceDetail(ActivityPlace):
    id: UUID
    destination_reference_id: UUID
    source: str
    retrieved_at: datetime


class PlacePage(ActivitySearch):
    notice: str | None = None
    results: list[PlaceDetail]


def detail(row):
    return PlaceDetail.model_validate(
        {
            **row.payload,
            "id": row.id,
            "destination_reference_id": row.destination_reference_id,
        }
    )


def retain(db, page, destination_id):
    snapshots = []
    for place in page.results:
        ident = uuid5(
            NAMESPACE_URL,
            f"osm:{destination_id}:{place.external_id}:{page.retrieved_at.isoformat()}",
        )
        snapshots.append(
            dict(
                id=ident,
                destination_reference_id=destination_id,
                payload={
                    **place.model_dump(mode="json"),
                    "source": page.source,
                    "retrieved_at": page.retrieved_at.isoformat(),
                },
            )
        )
    ids = [row["id"] for row in snapshots]
    if snapshots:
        db.execute(
            insert(DiscoveredPlace)
            .values(snapshots)
            .on_conflict_do_nothing(index_elements=["id"])
        )
    rows = (
        {
            row.id: row
            for row in db.scalars(
                select(DiscoveredPlace).where(DiscoveredPlace.id.in_(ids))
            )
        }
        if ids
        else {}
    )
    return PlacePage(
        **{**page.model_dump(), "results": [detail(rows[ident]) for ident in ids]}
    )


def plan_places(db, plan):
    return places_by_ids(db, {a.place_id for a in plan.activities if a.place_id})


def places_by_ids(db, ids):
    return {
        str(row.id): detail(row)
        for row in db.scalars(
            select(DiscoveredPlace).where(DiscoveredPlace.id.in_(ids))
        )
    }


def recent_discoveries(db, destination_id, category, now):
    from datetime import timedelta

    stamp = db.scalar(
        select(DiscoveredPlace.payload["retrieved_at"].as_string())
        .where(
            DiscoveredPlace.destination_reference_id == destination_id,
            DiscoveredPlace.payload["category"].as_string() == category,
        )
        .order_by(DiscoveredPlace.payload["retrieved_at"].as_string().desc())
        .limit(1)
    )
    if not stamp:
        return None
    retrieved = datetime.fromisoformat(stamp)
    if not now - timedelta(hours=24) <= retrieved <= now:
        return None
    rows = list(
        db.scalars(
            select(DiscoveredPlace)
            .where(
                DiscoveredPlace.destination_reference_id == destination_id,
                DiscoveredPlace.payload["category"].as_string() == category,
                DiscoveredPlace.payload["retrieved_at"].as_string() == stamp,
            )
            .order_by(DiscoveredPlace.id)
            .limit(12)
        )
    )
    if not rows:
        return None
    return PlacePage(
        results=[detail(row) for row in rows],
        source=rows[0].payload["source"],
        retrieved_at=retrieved,
        cached=True,
        notice="Live discovery refresh is unavailable. Showing retained results from the displayed retrieval time; hours and availability are not verified.",
    )
