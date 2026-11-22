"""FR-02: a destination's shortlist, the places and things a traveler wants, before they have a day or a time."""

from uuid import uuid4

import pytest
import test_trips
from pydantic import ValidationError

from app.trips.schemas import (
    MAX_WISHES_PER_DESTINATION,
    Preferences,
    WishItem,
    WishPlace,
)

context = test_trips.context


def place(**changes):
    return {
        "id": str(uuid4()),
        "destination_reference_id": str(uuid4()),
        "external_id": "geoapify/51abc",
        "name": "Albert Hall Museum",
        "category": "museum",
        "latitude": 26.9124,
        "longitude": 75.7873,
        "source": "Geoapify / OpenStreetMap contributors",
        "retrieved_at": "2026-11-22T10:00:00Z",
        **changes,
    }


def wish(**changes):
    return {"id": str(uuid4()), "label": "Albert Hall Museum", **changes}


def test_no_shortlist_is_the_default_and_a_bare_item_has_honest_defaults():
    assert Preferences().shortlists == {}
    item = WishItem.model_validate(wish())
    assert (item.must, item.minutes, item.place, item.note) == (False, None, None, "")


def test_a_saved_place_and_a_manual_entry_both_fit_and_survive_a_round_trip():
    prefs = Preferences.model_validate(
        {"shortlists": {"s1": [wish(must=True, minutes=90, place=place(), note="Go early"), wish(label="Chai at the corner stall")]}}
    )
    again = Preferences.model_validate(prefs.model_dump(mode="json"))
    first, second = again.shortlists["s1"]
    assert first.must and first.minutes == 90 and first.place.external_id == "geoapify/51abc"
    assert second.place is None and second.minutes is None  # missing stays unknown


@pytest.mark.parametrize(
    "item",
    [
        wish(label=""),
        wish(label="x" * 121),
        wish(label="Bell\x07"),
        wish(note="line\nbreak"),
        wish(note="n" * 301),
        wish(minutes=4),
        wish(minutes=721),
        wish(must="maybe"),
        {**wish(), "rating": 4.5},  # no unknown fields: nothing implies a sourced fact
        {"label": "no id"},
        wish(place=place(category="lodging")),  # stays have their own record
        wish(place=place(external_id="https://example.test/1")),
        wish(place=place(latitude=91)),
        wish(place=place(longitude=float("nan"))),
        wish(place=place(retrieved_at="yesterday")),
        wish(place=place(source="Geo\x00")),
        wish(place=place(name="")),
        wish(place=place(name="Bell\x07")),
        wish(place={**place(), "extra": 1}),
    ],
)
def test_entries_that_make_no_sense_are_refused(item):
    with pytest.raises(ValidationError):
        Preferences.model_validate({"shortlists": {"s1": [item]}})


def test_a_shortlist_has_a_size_limit_and_no_repeats():
    assert MAX_WISHES_PER_DESTINATION == 30  # the web app enforces the same number: change both together
    ok = [wish(label=f"Place {i}") for i in range(MAX_WISHES_PER_DESTINATION)]
    assert len(Preferences.model_validate({"shortlists": {"s1": ok}}).shortlists["s1"]) == MAX_WISHES_PER_DESTINATION
    with pytest.raises(ValidationError):
        Preferences.model_validate({"shortlists": {"s1": [*ok, wish()]}})
    repeated = wish()
    with pytest.raises(ValidationError):
        Preferences.model_validate({"shortlists": {"s1": [repeated, repeated]}})
    same_place = place()
    with pytest.raises(ValidationError):
        Preferences.model_validate({"shortlists": {"s1": [wish(place=same_place), wish(label="Again", place=same_place)]}})
    # the limit is per destination, and the same place may be on two destinations' lists
    two = Preferences.model_validate({"shortlists": {"s1": ok, "s2": [wish(place=same_place)]}})
    assert len(two.shortlists) == 2


def test_wish_models_are_strict_about_the_place_they_hold():
    assert WishPlace.model_validate(place()).category == "museum"
    with pytest.raises(ValidationError):
        WishPlace.model_validate({**place(), "id": "not-a-uuid"})


def test_the_shortlist_is_saved_with_the_draft_and_read_back(context):
    client, _, _ = context
    stop, saved = str(uuid4()), wish(must=True, minutes=45, place=place())
    plan = {
        "date_mode": "open_ended",
        "origin": {"label": "Delhi"},
        "preferences": {"shortlists": {stop: [saved, wish(label="A walk by the lake")]}},
        "stops": [{"client_id": stop, "name": "Jaipur", "timezone": "Asia/Kolkata", "desired_nights": 2}],
    }
    created = client.post("/api/v1/trips", json={"title": "Shortlist", "plan": plan})
    assert created.status_code == 201, created.text
    trip = created.json()["data"]
    version = client.get(f"/api/v1/trips/{trip['id']}/versions/{trip['draft_version_id']}").json()["data"]
    lists = version["preferences"]["shortlists"]
    stop_key = next(iter(lists))  # the stop's server-side logical id may be remapped from the client id
    assert [w["label"] for w in lists[stop_key]] == ["Albert Hall Museum", "A walk by the lake"]
    assert lists[stop_key][0]["place"]["external_id"] == "geoapify/51abc" and lists[stop_key][0]["minutes"] == 45
    # an old client that sends no shortlist keeps working
    bare = client.post("/api/v1/trips", json={"title": "Plain"})
    assert bare.status_code == 201


def test_a_bad_shortlist_is_refused_by_the_api_not_stored(context):
    client, _, _ = context
    stop = str(uuid4())
    plan = {
        "date_mode": "open_ended",
        "origin": {"label": "Delhi"},
        "preferences": {"shortlists": {stop: [wish(minutes=1)]}},
        "stops": [{"client_id": stop, "name": "Jaipur", "timezone": "Asia/Kolkata", "desired_nights": 2}],
    }
    assert client.post("/api/v1/trips", json={"title": "Bad", "plan": plan}).status_code == 422
