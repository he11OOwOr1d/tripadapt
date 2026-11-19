"""Deterministic proximity ordering; never an indoor, quality or route verdict."""

from datetime import timedelta

from app.providers.activities import distance


def rank_replacements(places, current_place, reference, category, now):
    anchor = (
        current_place
        if current_place and current_place.destination_reference_id == reference.id
        else None
    )
    latitude = anchor.latitude if anchor else reference.payload["latitude"]
    longitude = anchor.longitude if anchor else reference.payload["longitude"]
    basis = "activity_location" if anchor else "destination_centre"
    seen = set()
    options = []
    for place in places:
        if (
            place.destination_reference_id != reference.id
            or place.category != category
            or not timedelta(0) <= now - place.retrieved_at < timedelta(hours=24)
            or (anchor and place.external_id == anchor.external_id)
            or place.external_id in seen
        ):
            continue
        seen.add(place.external_id)
        options.append(
            dict(
                place=place,
                distance_meters=round(
                    distance(latitude, longitude, place.latitude, place.longitude)
                ),
                distance_basis=basis,
            )
        )
    options.sort(
        key=lambda option: (
            option["distance_meters"],
            option["place"].name.casefold(),
            str(option["place"].id),
        )
    )
    # Keep name diversity in the small display without merging source identities.
    # Other records remain eligible and available in the full planner lookup.
    shortlist, names = [], set()
    for option in options:
        name = " ".join(option["place"].name.casefold().split())
        if name in names:
            continue
        names.add(name)
        shortlist.append(option)
        if len(shortlist) == 3:
            break
    return shortlist, len(options)
