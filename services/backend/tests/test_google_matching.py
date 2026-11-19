from uuid import UUID

import pytest
import test_activity_discovery
import test_trips

from app.api import google_places
from app.persistence.models import DiscoveredPlace
from app.providers.google_places import GoogleMatch, GooglePlaces


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def test_context_and_larger_page_recover_nearby_fourth_result_without_distant_namesakes(
    context, monkeypatch
):
    client, _, _ = context
    destination, source = test_activity_discovery.discovered(client, monkeypatch)
    captured = []
    provider = GooglePlaces()

    def request(owner, path, fields, payload):
        captured.append((path, fields, payload))
        return {
            "places": [
                {
                    "id": f"ChIJ_{i}",
                    "displayName": {"text": "Namesake"},
                    "formattedAddress": "Address",
                    "location": {
                        "latitude": 0 if i < 3 else 35.02,
                        "longitude": 0 if i < 3 else 135.75,
                    },
                }
                for i in range(4)
            ]
        }

    monkeypatch.setattr(provider, "request", request)
    monkeypatch.setattr(google_places, "google_places", provider)
    response = client.post(
        "/api/v1/google-places/matches", json={"source_place_id": source["id"]}
    )
    assert response.status_code == 200, response.text
    assert [m["id"] for m in response.json()["data"]] == ["ChIJ_3"]
    assert response.json()["data"][0]["distance_meters"] == 0
    assert len(captured) == 1
    payload = captured[0][2]
    assert payload["textQuery"] == f"{source['name']}, {destination['label']}"
    assert (
        payload["pageSize"] == 10
        and payload["locationBias"]["circle"]["radius"] == 1000
    )
    assert "openingHours" not in captured[0][1]
    assert response.headers["cache-control"] == "private, no-store"


def test_explicit_refinement_is_trimmed_contextual_and_not_persisted(
    context, monkeypatch
):
    client, db, _ = context
    destination, source = test_activity_discovery.discovered(client, monkeypatch)
    captured = []

    class Fake:
        def matches(self, *args):
            captured.append(args)
            match = GoogleMatch(
                id="ChIJ_near",
                name="Nearby record",
                address="Transient address",
                latitude=35.0201,
                longitude=135.75,
            )
            return [
                match,
                match,
                GoogleMatch(
                    id="ChIJ_far",
                    name="Wrong city",
                    address="Far",
                    latitude=0,
                    longitude=0,
                ),
            ]

    monkeypatch.setattr(google_places, "google_places", Fake())
    query = "  Alternate venue spelling  "
    response = client.post(
        "/api/v1/google-places/matches",
        json={"source_place_id": source["id"], "query": query},
    )
    assert response.status_code == 200, response.text
    assert captured[0][1] == f"Alternate venue spelling, {destination['label']}"
    assert captured[0][2:] == (35.02, 135.75)
    assert len(response.json()["data"]) == 1
    assert 0 < response.json()["data"][0]["distance_meters"] < 1000
    row = db.get(DiscoveredPlace, UUID(source["id"]))
    assert row.payload["name"] == source["name"]
    assert "Alternate venue" not in str(row.payload) and "Transient address" not in str(
        row.payload
    )


@pytest.mark.parametrize("query", ["", "  ", "a", "bad\nname", "\nname", "x" * 161])
def test_invalid_refinement_stops_before_provider_calls(context, monkeypatch, query):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)

    class Fail:
        def matches(self, *args):
            pytest.fail("Invalid input must not reach Google")

    monkeypatch.setattr(google_places, "google_places", Fail())
    assert (
        client.post(
            "/api/v1/google-places/matches",
            json={"source_place_id": source["id"], "query": query},
        ).status_code
        == 422
    )


def test_refinement_cannot_bypass_the_distance_boundary_or_leak_into_hour_check(
    context, monkeypatch
):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)

    class Far:
        def matches(self, *args):
            return [
                GoogleMatch(
                    id="ChIJ_far",
                    name="User requested namesake",
                    address="Other country",
                    latitude=0,
                    longitude=0,
                )
            ]

    monkeypatch.setattr(google_places, "google_places", Far())
    response = client.post(
        "/api/v1/google-places/matches",
        json={"source_place_id": source["id"], "query": "Namesake in another city"},
    )
    assert response.status_code == 200 and response.json()["data"] == []
    assert (
        client.post(
            "/api/v1/google-places/check",
            json={
                "source_place_id": source["id"],
                "google_place_id": "ChIJ_far",
                "query": "Ignored?",
                "start": "10:00",
                "duration_minutes": 30,
            },
        ).status_code
        == 422
    )
