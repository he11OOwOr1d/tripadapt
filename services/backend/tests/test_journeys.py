import json
from uuid import uuid4

import pytest
import test_activity_discovery
import test_trips
from pydantic import SecretStr

from app.api import journeys
from app.api.identity import verified_identity
from app.config import settings
from app.main import app
from app.providers import google_places as transport
from app.providers.google_places import GoogleFailure, GooglePlaces


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


@pytest.mark.parametrize(
    "raw",
    [
        {},
        {"routes": []},
        {"routes": [{"duration": "NaNs", "distanceMeters": 1}]},
        {"routes": [{"duration": "-1s", "distanceMeters": 1}]},
        {"routes": [{"duration": "60s", "distanceMeters": True}]},
        {"routes": [{"duration": "60s", "distanceMeters": -1}]},
        {"routes": [{"duration": "60s", "distanceMeters": 1, "warnings": "bad"}]},
    ],
)
def test_bad_route_never_becomes_zero_time(raw):
    with pytest.raises(GoogleFailure):
        journeys.route_estimate(raw)


def test_fractional_seconds_round_up():
    assert journeys.route_estimate(
        {"routes": [{"duration": "60.001s", "distanceMeters": 100}]}
    ) == (2, 100, [])


@pytest.mark.parametrize(
    "start,buffer,status,spare",
    [
        ("11:00", 10, "fits_estimate", 30),
        ("10:20", 10, "shortfall", -10),
        ("09:30", 0, "shortfall", -50),
        ("10:30", 0, "fits_estimate", 10),
    ],
)
def test_gap_checks_and_no_mutation(context, monkeypatch, start, buffer, status, spare):
    client, db, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    calls = []

    def request(*args, **kwargs):
        calls.append((args, kwargs))
        return {
            "routes": [
                {"duration": "1200s", "distanceMeters": 1300, "warnings": ["Use care."]}
            ]
        }

    monkeypatch.setattr(journeys.google_places, "request", request)
    body = {
        "origin_place_id": source["id"],
        "destination_place_id": source["id"],
        "mode": "WALK",
        "origin_start": "09:00",
        "origin_minutes": 60,
        "destination_start": start,
        "buffer_minutes": buffer,
    }
    response = client.post("/api/v1/journeys/check", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    result = response.json()["data"]
    assert (result["status"], result["spare_minutes"]) == (status, spare)
    assert result["warnings"] == ["Use care."]
    assert calls[0][1] == {"routes": True}
    assert calls[0][0][2] == "routes.duration,routes.distanceMeters,routes.warnings"
    assert "routingPreference" not in calls[0][0][3]
    assert len(db.new) == 0
    body["mode"] = "DRIVE"
    assert client.post("/api/v1/journeys/check", json=body).status_code == 200
    assert calls[-1][0][3]["routingPreference"] == "TRAFFIC_UNAWARE"
    body["origin_start"] = "09:00:00+02:00"
    assert client.post("/api/v1/journeys/check", json=body).status_code == 422
    body["origin_start"] = "09:00"
    body["mode"] = "TRANSIT"
    assert client.post("/api/v1/journeys/check", json=body).status_code == 422
    body["mode"] = "WALK"
    body["destination_place_id"] = str(uuid4())
    assert client.post("/api/v1/journeys/check", json=body).status_code == 404
    app.dependency_overrides.pop(verified_identity)
    assert client.post("/api/v1/journeys/check", json=body).status_code == 401


def test_route_host_and_key_not_in_url(monkeypatch):
    monkeypatch.setattr(settings, "google_maps_api_key", SecretStr("places-only"))
    monkeypatch.setattr(settings, "routes_api_key", SecretStr("private-test"))
    seen = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, *args):
            return json.dumps({"routes": []}).encode()

    def open(request, **kwargs):
        seen.append(request)
        return Response()

    monkeypatch.setattr(transport, "urlopen", open)
    GooglePlaces().request(
        "owner", "", "routes.duration", {"travelMode": "WALK"}, routes=True
    )
    assert (
        seen[0].full_url == "https://routes.googleapis.com/directions/v2:computeRoutes"
    )
    assert seen[0].get_header("X-goog-api-key") == "private-test"


def test_route_failure_and_destination_boundary(context, monkeypatch):
    from uuid import UUID

    from app.persistence.models import DiscoveredPlace, PlaceReference

    client, db, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)

    def denied(*args, **kwargs):
        raise GoogleFailure("GOOGLE_PLACES_ACCESS_DENIED")

    monkeypatch.setattr(journeys.google_places, "request", denied)
    body = {
        "origin_place_id": source["id"],
        "destination_place_id": source["id"],
        "mode": "WALK",
        "origin_start": "09:00",
        "origin_minutes": 60,
        "destination_start": "10:00",
    }
    failed = client.post("/api/v1/journeys/check", json=body)
    assert failed.status_code == 503
    assert failed.json()["code"] == "GOOGLE_ROUTES_ACCESS_DENIED"
    original = db.get(DiscoveredPlace, UUID(source["id"]))
    reference = db.get(PlaceReference, original.destination_reference_id)
    other = PlaceReference(
        id=uuid4(),
        provider=reference.provider,
        provider_place_id=reference.provider_place_id,
        payload=reference.payload,
    )
    db.add(other)
    db.flush()
    place = DiscoveredPlace(
        id=uuid4(), destination_reference_id=other.id, payload=original.payload
    )
    db.add(place)
    db.flush()
    body["destination_place_id"] = str(place.id)
    db.commit()
    response = client.post("/api/v1/journeys/check", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == "JOURNEY_DIFFERENT_DESTINATIONS"
