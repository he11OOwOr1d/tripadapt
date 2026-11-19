import json
from types import SimpleNamespace
from urllib.error import HTTPError
from uuid import uuid4

import pytest
import test_activity_discovery
import test_trips
from pydantic import SecretStr
from sqlalchemy import func, select

from app.api import journeys
from app.api.identity import verified_identity
from app.config import settings
from app.main import app
from app.persistence.models import PlaceReference
from app.providers import geoapify_checks as transport
from app.providers.geoapify_checks import (
    CheckFailure,
    GeoapifyChecks,
    RouteEstimate,
    parse_route,
)


def geo(time, distance, **extra):
    return {"features": [{"properties": {"time": time, "distance": distance, **extra}}]}


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


@pytest.mark.parametrize(
    "raw",
    [
        {},
        {"features": []},
        {"features": [{}]},
        {"features": [{"properties": {"time": 60}}]},
        geo("60", 1),
        geo(float("nan"), 1),
        geo(float("inf"), 1),
        geo(-1, 1),
        geo(604801, 1),
        geo(60, True),
        geo(True, 1),
        geo(60, -1),
        geo(60, 20000001),
        geo(60, 1, distance_units="miles"),
    ],
)
def test_bad_route_never_becomes_zero_time(raw):
    with pytest.raises(CheckFailure) as failure:
        parse_route(raw)
    assert failure.value.code == "ROUTES_UNAVAILABLE"


def test_fractional_seconds_round_up_and_distance_rounds():
    assert parse_route(geo(60.001, 100.4)) == (2, 100, [])
    assert parse_route(geo(0, 0)) == (0, 0, [])
    assert parse_route(geo(4222.762, 4780, distance_units="meters")) == (71, 4780, [])


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

    def route(*args, **kwargs):
        calls.append((args, kwargs))
        return RouteEstimate(20, 1300, ["Use care."])

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=route))
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
    owner, mode, origin, destination = calls[0][0]
    assert mode == "WALK" and len(origin) == len(destination) == 2
    assert len(db.new) == 0
    body["mode"] = "DRIVE"
    assert client.post("/api/v1/journeys/check", json=body).status_code == 200
    assert calls[-1][0][1] == "DRIVE"
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


@pytest.mark.parametrize(
    "start,buffer,status,leave_by",
    [
        ("09:00", 10, "leave_by", "08:30"),
        ("09:00", 0, "leave_by", "08:40"),
        ("00:25", 10, "needs_earlier_start", None),
        ("00:30", 10, "leave_by", "00:00"),
        ("09:00:45", 10, "leave_by", "08:30"),
    ],
)
def test_stay_journey_gives_a_leave_by_time(
    context, monkeypatch, start, buffer, status, leave_by
):
    client, db, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    calls = []

    def route(*args):
        calls.append(args)
        return RouteEstimate(20, 1300, ["Use care."])

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=route))
    body = {
        "latitude": 26.9,
        "longitude": 75.8,
        "destination_place_id": source["id"],
        "mode": "WALK",
        "destination_start": start,
        "buffer_minutes": buffer,
    }
    response = client.post("/api/v1/journeys/from-stay", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    result = response.json()["data"]
    assert (result["status"], result["leave_by"]) == (status, leave_by)
    assert result["travel_minutes"] == 20 and result["warnings"] == ["Use care."]
    assert calls[0][2] == (26.9, 75.8)
    assert len(db.new) == 0


@pytest.mark.parametrize(
    "change",
    [
        {"latitude": 0, "longitude": 0},
        {"latitude": 91},
        {"longitude": -181},
        {"mode": "TRANSIT"},
        {"destination_start": "09:00:00+02:00"},
        {"buffer_minutes": 121},
        {"extra": 1},
    ],
)
def test_stay_journey_rejects_bad_input(context, monkeypatch, change):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    monkeypatch.setattr(
        journeys,
        "geoapify_checks",
        SimpleNamespace(route=lambda *a: RouteEstimate(1, 1, [])),
    )
    body = {
        "latitude": 26.9,
        "longitude": 75.8,
        "destination_place_id": source["id"],
        "mode": "WALK",
        "destination_start": "09:00",
        **change,
    }
    assert client.post("/api/v1/journeys/from-stay", json=body).status_code == 422


def test_stay_journey_needs_known_place_and_sign_in(context, monkeypatch):
    client, _, _ = context
    body = {
        "latitude": 26.9,
        "longitude": 75.8,
        "destination_place_id": str(uuid4()),
        "mode": "WALK",
        "destination_start": "09:00",
    }
    assert client.post("/api/v1/journeys/from-stay", json=body).status_code == 404
    app.dependency_overrides.pop(verified_identity)
    assert client.post("/api/v1/journeys/from-stay", json=body).status_code == 401


@pytest.mark.parametrize(
    "end,status,arrive_by",
    [
        ("18:00", "arrive_by", "18:20"),
        ("23:39", "arrive_by", "23:59"),
        ("23:40", "after_midnight", None),
        ("23:59:30", "after_midnight", None),
    ],
)
def test_return_to_stay_gives_an_arrive_by_time(
    context, monkeypatch, end, status, arrive_by
):
    client, db, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    calls = []

    def route(*args):
        calls.append(args)
        return RouteEstimate(20, 1300, [])

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=route))
    body = {
        "latitude": 26.9,
        "longitude": 75.8,
        "origin_place_id": source["id"],
        "mode": "DRIVE",
        "origin_end": end,
    }
    response = client.post("/api/v1/journeys/to-stay", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    result = response.json()["data"]
    assert (result["status"], result["arrive_by"]) == (status, arrive_by)
    assert calls[0][1] == "DRIVE" and calls[0][3] == (26.9, 75.8)
    assert len(db.new) == 0


@pytest.mark.parametrize(
    "change",
    [
        {"latitude": 0, "longitude": 0},
        {"longitude": 181},
        {"mode": "TRANSIT"},
        {"origin_end": "18:00:00+02:00"},
        {"extra": 1},
    ],
)
def test_return_to_stay_rejects_bad_input(context, monkeypatch, change):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    monkeypatch.setattr(
        journeys,
        "geoapify_checks",
        SimpleNamespace(route=lambda *a: RouteEstimate(1, 1, [])),
    )
    body = {
        "latitude": 26.9,
        "longitude": 75.8,
        "origin_place_id": source["id"],
        "mode": "WALK",
        "origin_end": "18:00",
        **change,
    }
    assert client.post("/api/v1/journeys/to-stay", json=body).status_code == 422


def test_return_to_stay_needs_known_place_and_sign_in(context):
    client, _, _ = context
    body = {
        "latitude": 26.9,
        "longitude": 75.8,
        "origin_place_id": str(uuid4()),
        "mode": "WALK",
        "origin_end": "18:00",
    }
    assert client.post("/api/v1/journeys/to-stay", json=body).status_code == 404
    app.dependency_overrides.pop(verified_identity)
    assert client.post("/api/v1/journeys/to-stay", json=body).status_code == 401


def reference(db, number, latitude, longitude):
    from app.persistence.models import PlaceReference

    ident = uuid4()
    row = PlaceReference(
        id=ident,
        provider="open_meteo_geonames",
        provider_place_id=number,
        payload={"latitude": latitude, "longitude": longitude},
    )
    db.add(row)
    db.commit()
    return ident


def test_intercity_drive_estimate_uses_the_two_references_and_stores_nothing(
    context, monkeypatch
):
    client, db, _ = context
    delhi = reference(db, 1273294, 28.61, 77.21)
    jaipur = reference(db, 1269515, 26.91, 75.79)
    calls = []

    def route(*args):
        calls.append(args)
        return RouteEstimate(270, 281000, ["Check road conditions."])

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=route))
    body = {
        "origin": {"reference_id": str(delhi)},
        "destination": {"reference_id": str(jaipur)},
    }
    before = db.scalar(select(func.count()).select_from(PlaceReference))
    db.commit()
    response = client.post("/api/v1/journeys/intercity", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    result = response.json()["data"]
    assert result["mode"] == "DRIVE"
    assert (result["travel_minutes"], result["distance_meters"]) == (270, 281000)
    assert result["warnings"] == ["Check road conditions."]
    _, mode, origin, destination = calls[0]
    assert (
        mode == "DRIVE" and origin == (28.61, 77.21) and destination == (26.91, 75.79)
    )
    db.commit()
    assert db.scalar(select(func.count()).select_from(PlaceReference)) == before


def test_intercity_accepts_the_trips_starting_point_as_coordinates_at_either_end(
    context, monkeypatch
):
    client, db, _ = context
    jaipur = reference(db, 1269515, 26.91, 75.79)
    calls = []

    def route(*args):
        calls.append(args)
        return RouteEstimate(60, 1000, [])

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=route))
    home = {"latitude": 28.61, "longitude": 77.21}
    stop = {"reference_id": str(jaipur)}
    url = "/api/v1/journeys/intercity"
    assert (
        client.post(url, json={"origin": home, "destination": stop}).status_code == 200
    )
    assert (
        client.post(url, json={"origin": stop, "destination": home}).status_code == 200
    )
    assert calls[0][2:] == ((28.61, 77.21), (26.91, 75.79))
    assert calls[1][2:] == ((26.91, 75.79), (28.61, 77.21))


def test_intercity_rejects_bad_places_unknown_ids_extra_fields_and_anonymous(
    context, monkeypatch
):
    client, db, _ = context
    one = reference(db, 111, 10.0, 10.0)
    two = reference(db, 222, 11.0, 11.0)
    monkeypatch.setattr(
        journeys,
        "geoapify_checks",
        SimpleNamespace(route=lambda *a: RouteEstimate(1, 1, [])),
    )
    url = "/api/v1/journeys/intercity"
    a, b = {"reference_id": str(one)}, {"reference_id": str(two)}
    point = {"latitude": 10.0, "longitude": 10.0}
    bad = [
        {"origin": a, "destination": a},  # the same reference
        {"origin": point, "destination": point},  # the same point
        {"origin": a, "destination": {"reference_id": str(two), **point}},  # both forms
        {"origin": a, "destination": {"latitude": 10.0}},  # one coordinate
        {"origin": a, "destination": {}},  # neither
        {"origin": a, "destination": {"latitude": 0, "longitude": 0}},
        {"origin": a, "destination": {"latitude": 91, "longitude": 0}},
        {"origin": a, "destination": {**b, "extra": 1}},
        {"origin": a, "destination": b, "mode": "WALK"},
        {"origin": "x", "destination": "y"},
    ]
    for body in bad:
        assert client.post(url, json=body).status_code == 422, body
    raw = (
        '{"origin": {"reference_id": "%s"}, "destination": {"latitude": NaN, "longitude": 1}}'
        % one
    )
    nan = client.post(url, content=raw, headers={"content-type": "application/json"})
    assert nan.status_code == 422
    unknown = {"reference_id": str(uuid4())}
    assert (
        client.post(url, json={"origin": a, "destination": unknown}).status_code == 404
    )
    # A point equal to a reference's own coordinates is still the same place.
    assert client.post(url, json={"origin": a, "destination": point}).status_code == 422
    app.dependency_overrides.pop(verified_identity)
    assert client.post(url, json={"origin": a, "destination": b}).status_code == 401


def test_intercity_provider_failure_is_reported_not_zero(context, monkeypatch):
    client, db, _ = context
    one = reference(db, 333, 10.0, 10.0)
    two = reference(db, 444, 11.0, 11.0)

    def failing(*args):
        raise CheckFailure("ROUTES_UNAVAILABLE", 503)

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=failing))
    response = client.post(
        "/api/v1/journeys/intercity",
        json={
            "origin": {"reference_id": str(one)},
            "destination": {"reference_id": str(two)},
        },
    )
    assert response.status_code == 503
    assert "ROUTES_UNAVAILABLE" in response.text


class Response:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self, size):
        assert size == transport.MAX_RESPONSE_BYTES + 1
        return json.dumps(self.body).encode()


def test_route_request_uses_geoapify_walk_drive_and_fixed_budget(monkeypatch):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("private-test"))
    seen = []

    def open(request, **options):
        seen.append((request, options))
        return Response(geo(600, 700))

    monkeypatch.setattr(transport, "urlopen", open)
    client = GeoapifyChecks()
    assert client.route("owner", "WALK", (37.78, -122.4161), (37.77, -122.4862)) == (
        10,
        700,
        [],
    )
    client.route("owner", "DRIVE", (1, 2), (3, 4))
    walk, options = seen[0]
    assert walk.full_url.startswith("https://api.geoapify.com/v1/routing?")
    assert "mode=walk" in walk.full_url
    assert (
        "waypoints=37.780000%2C-122.416100%7C37.770000%2C-122.486200" in walk.full_url
    )
    assert "mode=drive" in seen[1][0].full_url
    assert options["context"].check_hostname and options["timeout"] == 8
    assert walk.get_method() == "GET" and walk.data is None


@pytest.mark.parametrize(
    "status,code",
    [
        (401, "ROUTES_ACCESS_DENIED"),
        (403, "ROUTES_ACCESS_DENIED"),
        (404, "ROUTES_NOT_FOUND"),
        (429, "ROUTES_RATE_LIMITED"),
        (400, "ROUTES_UNAVAILABLE"),
        (500, "ROUTES_UNAVAILABLE"),
    ],
)
def test_route_errors_do_not_expose_credential_or_response(monkeypatch, status, code):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))

    def failed(*args, **kwargs):
        raise HTTPError("https://x/?apiKey=test-secret", status, "private", {}, None)

    monkeypatch.setattr(transport, "urlopen", failed)
    with pytest.raises(CheckFailure) as failure:
        GeoapifyChecks().route("owner", "WALK", (1, 2), (3, 4))
    assert failure.value.code == code
    assert "test-secret" not in str(failure.value) and failure.value.__cause__ is None


@pytest.mark.parametrize(
    "body", [[], {"error": "bad"}, {"features": "x"}, "not json at all"]
)
def test_route_rejects_malformed_or_oversized_responses(monkeypatch, body):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    monkeypatch.setattr(transport, "urlopen", lambda *a, **k: Response(body))
    with pytest.raises(CheckFailure) as failure:
        GeoapifyChecks().route("owner", "WALK", (1, 2), (3, 4))
    assert failure.value.code == "ROUTES_UNAVAILABLE"


def test_route_response_over_limit_is_refused(monkeypatch):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    monkeypatch.setattr(transport, "MAX_RESPONSE_BYTES", 10)
    monkeypatch.setattr(transport, "urlopen", lambda *a, **k: Response(geo(60, 1)))
    with pytest.raises(CheckFailure, match="ROUTES_UNAVAILABLE"):
        GeoapifyChecks().route("owner", "WALK", (1, 2), (3, 4))


def test_route_not_configured_makes_no_call(monkeypatch):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr(""))
    monkeypatch.setattr(
        transport, "urlopen", lambda *a, **k: pytest.fail("must not call upstream")
    )
    with pytest.raises(CheckFailure) as failure:
        GeoapifyChecks().route("owner", "WALK", (1, 2), (3, 4))
    assert failure.value.code == "ROUTES_NOT_CONFIGURED"


def test_route_quota_and_concurrency_do_not_call_upstream(monkeypatch):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    monkeypatch.setattr(
        transport, "urlopen", lambda *a, **k: pytest.fail("must not call upstream")
    )
    client = GeoapifyChecks(clock=lambda: 0)
    client.calls.extend([0] * transport.PER_MINUTE_LIMIT)
    with pytest.raises(CheckFailure) as limited:
        client.route("owner", "WALK", (1, 2), (3, 4))
    assert (limited.value.code, limited.value.status) == ("ROUTES_RATE_LIMITED", 429)
    client = GeoapifyChecks(clock=lambda: 0)
    client.owners["owner"].extend([0] * transport.PER_OWNER_DAILY_LIMIT)
    with pytest.raises(CheckFailure, match="ROUTES_RATE_LIMITED"):
        client.route("owner", "WALK", (1, 2), (3, 4))
    client = GeoapifyChecks()
    client.slots.acquire()
    client.slots.acquire()
    with pytest.raises(CheckFailure) as busy:
        client.route("owner", "WALK", (1, 2), (3, 4))
    assert (busy.value.code, busy.value.status) == ("ROUTES_BUSY", 429)


def test_route_failure_and_destination_boundary(context, monkeypatch):
    from uuid import UUID

    from app.persistence.models import DiscoveredPlace, PlaceReference

    client, db, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)

    def denied(*args, **kwargs):
        raise CheckFailure("ROUTES_ACCESS_DENIED")

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=denied))
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
    assert failed.json()["code"] == "ROUTES_ACCESS_DENIED"
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


def test_a_full_six_visit_acceptance_fits_in_one_minute(monkeypatch):
    """Six hours checks plus seven routes must not trip the per-minute limit."""
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    monkeypatch.setattr(transport, "urlopen", lambda *a, **k: Response(geo(60, 100)))
    client = GeoapifyChecks(clock=lambda: 0)
    for _ in range(13):
        assert client.route("owner", "WALK", (1, 2), (3, 4)).minutes == 1
    assert 13 < transport.PER_MINUTE_LIMIT


def test_the_daily_cap_protects_the_shared_free_allowance(monkeypatch):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    monkeypatch.setattr(
        transport, "urlopen", lambda *a, **k: pytest.fail("must not call upstream")
    )
    client = GeoapifyChecks(clock=lambda: 1000)
    # Calls from earlier in the day, outside the one-minute window.
    client.calls.extend([0] * transport.DAILY_LIMIT)
    with pytest.raises(CheckFailure, match="ROUTES_RATE_LIMITED"):
        client.route("someone-else", "WALK", (1, 2), (3, 4))
    assert transport.DAILY_LIMIT < 3000
