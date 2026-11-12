import json
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs
from uuid import uuid4

import pytest
import test_place_references
import test_proposals
import test_revisions
import test_trips
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.api import places
from app.api.identity import verified_identity
from app.config import settings
from app.main import app
from app.providers import activities
from app.providers.activities import ActivityDiscovery, DiscoveryFailure


@pytest.fixture(autouse=True)
def isolated_provider(monkeypatch):
    # Never let a developer's optional hosted key change transport tests.
    monkeypatch.setattr(settings, "activity_places_provider", "overpass")


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def museum(**changes):
    return {
        "type": "node",
        "id": 100,
        "tags": {"name": "Mapped museum", "tourism": "museum"},
        "lat": 35.02,
        "lon": 135.75,
        **changes,
    }


def test_normalized_bounded_search_and_cache_do_not_alias():
    calls = []
    provider = ActivityDiscovery(
        lambda *args: (
            calls.append(args)
            or {
                "elements": [
                    museum(),
                    museum(),
                    museum(id=101, lat=0),
                    museum(id=102, lat="NaN"),
                    museum(id=103, tags={"name": "bad\nname", "tourism": "museum"}),
                ]
            }
        )
    )
    page = provider.search(35.02, 135.75, "museum")
    assert len(page.results) == 1
    assert page.coverage == "partial" and page.radius_meters == 5000
    assert page.results[0].external_id == "node/100"
    cached = provider.search(35.02, 135.75, "museum")
    assert cached.cached and cached.retrieved_at == page.retrieved_at
    cached.results.clear()
    assert len(provider.search(35.02, 135.75, "museum").results) == 1
    assert len(calls) == 1


def test_centres_and_categories_are_validated():
    provider = ActivityDiscovery(
        lambda *args: {
            "elements": [
                museum(type="way", id=101, center={"lat": 35.021, "lon": 135.751})
            ]
        }
    )
    assert provider.search(35.02, 135.75, "museum").results[0].external_id == "way/101"
    for args in [
        (float("nan"), 1, "museum"),
        (91, 1, "museum"),
        (1, 1, "arbitrary query"),
    ]:
        with pytest.raises(DiscoveryFailure):
            provider.search(*args)


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"remark": "partial timeout", "elements": []},
        {"elements": [None]},
        {"elements": [museum(type="javascript:")]},
    ],
)
def test_invalid_or_partial_upstream_is_not_an_empty_success(data):
    with pytest.raises(DiscoveryFailure):
        ActivityDiscovery(lambda *args: data).search(35.02, 135.75, "museum")


def test_empty_coverage_is_honest_and_output_limit_is_twelve():
    assert (
        ActivityDiscovery(lambda *args: {"elements": []}).search(1, 1, "museum").results
        == []
    )
    page = ActivityDiscovery(
        lambda *args: {"elements": [museum(id=i + 1) for i in range(40)]}
    ).search(35.02, 135.75, "museum")
    assert len(page.results) == 12


def test_rate_ttl_cache_size_and_concurrency_are_bounded():
    stamp = [0]
    provider = ActivityDiscovery(lambda *args: {"elements": []}, clock=lambda: stamp[0])
    for i in range(6):
        provider.search(i, 1, "museum")
    with pytest.raises(DiscoveryFailure) as failure:
        provider.search(7, 1, "museum")
    assert failure.value.status == 429
    assert provider.search(0, 1, "museum").cached
    for i in range(130):
        stamp[0] += 61
        provider.search(i / 10, 2, "park")
    assert len(provider.cache) == 128
    stamp[0] += 86400
    assert not provider.search(12.9, 2, "park").cached
    provider.slots.acquire()
    provider.slots.acquire()
    with pytest.raises(DiscoveryFailure) as failure:
        provider.search(1, 3, "gallery")
    assert failure.value.code == "ACTIVITY_SEARCH_BUSY"


def test_transport_has_fixed_host_allowlisted_query_and_verified_tls(monkeypatch):
    monkeypatch.setattr(settings, "activity_places_provider", "overpass")
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, size):
            captured["size"] = size
            return json.dumps({"elements": []}).encode()

    def fetch(request, **kwargs):
        captured.update(kwargs, url=request.full_url, data=request.data)
        return Response()

    monkeypatch.setattr(activities, "urlopen", fetch)
    activities.fetch_places(35.02, 135.75, "museum")
    assert captured["url"] == "https://overpass-api.de/api/interpreter"
    query = parse_qs(captured["data"].decode())["data"][0]
    assert "around:5000,35.020000,135.750000" in query and "out center 40" in query
    assert captured["timeout"] == 8 and captured["size"] == 131073
    assert captured["context"].verify_mode == ssl.CERT_REQUIRED
    assert captured["context"].check_hostname


@pytest.mark.parametrize(
    "error,status",
    [(HTTPError("ignored", 429, "private", {}, None), 429), (URLError("private"), 503)],
)
def test_transport_errors_do_not_expose_provider_details(monkeypatch, error, status):
    def failed(*args, **kwargs):
        raise error

    monkeypatch.setattr(activities, "urlopen", failed)
    with pytest.raises(DiscoveryFailure) as failure:
        activities.fetch_places(1, 1, "museum")
    assert failure.value.status == status and "private" not in failure.value.code


def discovered(client, monkeypatch):
    destination = test_place_references.selected(client, monkeypatch)
    monkeypatch.setattr(settings, "activity_search_enabled", True)
    monkeypatch.setattr(
        places,
        "activity_discovery",
        ActivityDiscovery(lambda *args: {"elements": [museum()]}),
    )
    url = f"/api/v1/places/search?destination_reference_id={destination['reference_id']}&category=museum"
    response = client.get(url)
    assert response.status_code == 200, response.text
    place = response.json()["data"]["results"][0]
    assert client.get(url).json()["data"]["results"][0] == place
    assert client.get(f"/api/v1/places/{place['id']}").json()["data"] == place
    return destination, place


def test_public_search_errors_and_private_cache(context, monkeypatch):
    client, _, _ = context
    app.dependency_overrides.pop(verified_identity)
    destination, _ = discovered(client, monkeypatch)
    url = (
        f"/api/v1/places/search?destination_reference_id={destination['reference_id']}"
    )
    assert client.get(url).headers["cache-control"] == "private, no-store"
    assert client.get(url + "&category=unknown").status_code == 422
    assert (
        client.get(
            f"/api/v1/places/search?destination_reference_id={uuid4()}"
        ).status_code
        == 404
    )
    monkeypatch.setattr(settings, "activity_search_enabled", False)
    assert client.get(url).json()["code"] == "ACTIVITY_SEARCH_DISABLED"


def test_place_schedule_reopen_accept_and_restore_preserve_source(context, monkeypatch):
    client, db, _ = context
    destination, place = discovered(client, monkeypatch)
    stop_id = str(uuid4())
    activity = {
        "logical_id": str(uuid4()),
        "stop_logical_id": stop_id,
        "user_label": place["name"],
        "place_id": place["id"],
        "local_day_offset": 0,
        "local_start_time": "10:00",
        "duration_minutes": 60,
    }
    stop = {
        "client_id": stop_id,
        "name": destination["label"],
        "timezone": destination["timezone"],
        "desired_nights": 3,
        "place_reference_id": destination["reference_id"],
    }
    response = client.post(
        "/api/v1/trips",
        json={
            "title": "Discovery check",
            "plan": {"stops": [stop], "activities": [activity]},
        },
    )
    assert response.status_code == 201, response.text
    trip = response.json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    url = f"{base}/versions/{trip['draft_version_id']}"
    loaded = client.get(url)
    assert loaded.json()["data"]["place_details"][place["id"]] == place
    proposal = test_proposals.submit(client, base, loaded.headers["etag"]).json()[
        "data"
    ]
    assert proposal["place_details"][place["id"]] == place
    assert test_proposals.accept(client, base, proposal).status_code == 200
    changed = client.post(
        base + "/draft/commands",
        headers={"If-Match": loaded.headers["etag"]},
        json={
            "commands": [{"type": "activity.replace_user_schedule", "activities": []}]
        },
    )
    assert changed.status_code == 200
    tag = changed.headers["etag"]
    removed = test_proposals.submit(client, base, tag).json()["data"]
    assert test_proposals.accept(client, base, removed).status_code == 200
    restored = test_revisions.restore(
        client, base, proposal["candidate_version_id"], tag
    )
    assert restored.status_code == 202, restored.text
    assert (
        test_proposals.accept(client, base, restored.json()["data"]).status_code == 200
    )
    assert client.get(url).json()["data"]["place_details"][place["id"]] == place
    for statement in [
        "UPDATE discovered_place SET payload='{}'::jsonb WHERE id=:id",
        "DELETE FROM discovered_place WHERE id=:id",
    ]:
        with pytest.raises(DBAPIError):
            with db.begin_nested():
                db.execute(text(statement), {"id": place["id"]})


@pytest.mark.parametrize(
    "change", [{"place_id": str(uuid4())}, {"user_label": "Forged name"}]
)
def test_place_references_cannot_be_forged(context, monkeypatch, change):
    client, _, _ = context
    destination, place = discovered(client, monkeypatch)
    stop = str(uuid4())
    response = client.post(
        "/api/v1/trips",
        json={
            "title": "Bad place",
            "plan": {
                "stops": [
                    {
                        "client_id": stop,
                        "name": destination["label"],
                        "timezone": destination["timezone"],
                        "place_reference_id": destination["reference_id"],
                    }
                ],
                "activities": [
                    {
                        "logical_id": str(uuid4()),
                        "stop_logical_id": stop,
                        "user_label": place["name"],
                        "place_id": place["id"],
                        "local_day_offset": 0,
                        "local_start_time": "10:00",
                        "duration_minutes": 60,
                        **change,
                    }
                ],
            },
        },
    )
    assert (
        response.status_code == 422
        and response.json()["code"] == "ACTIVITY_PLACE_MISMATCH"
    )


def test_failed_live_refresh_can_explicitly_show_recent_retained_results(
    context, monkeypatch
):
    client, _, _ = context
    destination, place = discovered(client, monkeypatch)

    class Failed:
        def search(self, *args):
            raise DiscoveryFailure("ACTIVITY_PROVIDER_UNAVAILABLE")

    monkeypatch.setattr(places, "activity_discovery", Failed())
    result = client.get(
        f"/api/v1/places/search?destination_reference_id={destination['reference_id']}&category=museum"
    )
    assert result.status_code == 200
    page = result.json()["data"]
    assert page["cached"] and page["notice"].startswith(
        "Live discovery refresh is unavailable"
    )
    assert page["retrieved_at"] == place["retrieved_at"]
    assert page["results"][0]["id"] == place["id"]
    assert (
        client.get(
            f"/api/v1/places/search?destination_reference_id={destination['reference_id']}&category=gallery"
        ).status_code
        == 503
    )
