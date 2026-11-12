"""Immutable server-created location evidence; clients submit only its reference."""

from datetime import datetime
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.persistence.models import PlaceReference
from app.providers.geocoding import Place, PlaceSearch


class ReferencedPlace(Place):
    reference_id: UUID
    source: str
    retrieved_at: datetime


class ReferencedSearch(PlaceSearch):
    results: list[ReferencedPlace]


def reference_view(row):
    return ReferencedPlace.model_validate({**row.payload, "reference_id": row.id})


def retain_search(db, page):
    snapshots = []
    for place in page.results:
        ident = uuid5(
            NAMESPACE_URL,
            f"open-meteo-geonames:{place.id}:{page.retrieved_at.isoformat()}",
        )
        snapshots.append(
            dict(
                id=ident,
                provider="open_meteo_geonames",
                provider_place_id=place.id,
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
            insert(PlaceReference)
            .values(snapshots)
            .on_conflict_do_nothing(index_elements=["id"])
        )
    rows = (
        {
            row.id: row
            for row in db.scalars(
                select(PlaceReference).where(PlaceReference.id.in_(ids))
            )
        }
        if ids
        else {}
    )
    return ReferencedSearch(
        results=[reference_view(rows[ident]) for ident in ids],
        source=page.source,
        retrieved_at=page.retrieved_at,
        cached=page.cached,
    )


def references_for_plan(db, plan):
    ids = {s.place_reference_id for s in plan.stops if s.place_reference_id}
    return {
        str(row.id): reference_view(row)
        for row in db.scalars(select(PlaceReference).where(PlaceReference.id.in_(ids)))
    }
