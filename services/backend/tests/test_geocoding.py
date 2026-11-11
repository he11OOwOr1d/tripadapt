import json
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.api import destinations
from app.config import settings
from app.main import app
from app.providers import geocoding
from app.providers.geocoding import Geocoder, GeocodingFailure


def item(**overrides):
    return {
        "id": 1857910,
        "name": "Kyoto",
        "admin1": "Kyoto",
        "country": "Japan",
        "timezone": "Asia/Tokyo",
        "latitude": 35.02,
        "longitude": 135.75,
        **overrides,
    }


def test_lookup_normalizes_deduplicates_and_caches_without_mutable_aliases():
    calls = []
    provider = Geocoder(
        lambda query: (
            calls.append(query)
            or {"results": [item(), item(), item(id=2, timezone="Not/AZone")]}
        )
    )
    first = provider.search("Kyoto, Japan")
    assert len(first.results) == 1
    assert first.results[0].label == "Kyoto, Japan"
    assert not first.cached
    cached = provider.search("KYOTO, JAPAN")
    assert cached.cached and cached.retrieved_at == first.retrieved_at
    cached.results.clear()
    assert len(provider.search("Kyoto, Japan").results) == 1
    assert len(calls) == 1


def test_cache_expires_and_has_a_fixed_size():
    now = [0]
    calls = []
    provider = Geocoder(lambda q: calls.append(q) or {}, clock=lambda: now[0])
    for i in range(205):
        now[0] += 61
        provider.search(str(i))
    assert len(provider.cache) == 200
    provider.search("204")
    assert len(calls) == 205
    now[0] += 86400
    provider.search("204")
    assert len(calls) == 206


def test_bounded_rate_and_concurrency_are_explicit():
    provider = Geocoder(lambda q: {}, clock=lambda: 0)
    for i in range(30):
        provider.search(str(i))
    with pytest.raises(GeocodingFailure) as error:
        provider.search("overflow")
    assert error.value.status == 429
    assert provider.search("0").cached
    provider = Geocoder(lambda q: {})
    for _ in range(4):
        provider.slots.acquire()
    with pytest.raises(GeocodingFailure) as error:
        provider.search("busy")
    assert error.value.code == "PLACE_SEARCH_BUSY"


@pytest.mark.parametrize(
    "data",
    [
        {"results": "wrong"},
        {"results": [item(latitude="NaN")]},
        {"results": [item(timezone="missing")]},
        {"results": [None]},
    ],
)
def test_bad_evidence_cannot_become_a_choice(data):
    with pytest.raises(GeocodingFailure):
        Geocoder(lambda q: data).search("Kyoto")


def test_public_lookup_and_manual_fallback_statuses(monkeypatch):
    monkeypatch.setattr(settings, "place_search_enabled", True)
    queries = []
    monkeypatch.setattr(
        destinations,
        "geocoder",
        Geocoder(lambda q: queries.append(q) or {"results": [item()]}),
    )
    with TestClient(app) as client:
        result = client.get("/api/v1/destinations/search", params={"q": " Kyoto,   Japan "})
        assert result.status_code == 200, result.text
        assert result.json()["data"]["results"][0]["timezone"] == "Asia/Tokyo"
        assert result.headers["cache-control"] == "private, no-store"
        assert queries == ["Kyoto, Japan"]
        assert client.get("/api/v1/destinations/search?q=x").status_code == 422
        assert (
            client.get(
                "/api/v1/destinations/search", params={"q": "Kyoto\nJapan"}
            ).status_code
            == 422
        )
        monkeypatch.setattr(settings, "place_search_enabled", False)
        assert (
            client.get("/api/v1/destinations/search?q=Kyoto").json()["code"]
            == "PLACE_SEARCH_DISABLED"
        )


def test_transport_uses_fixed_host_verified_tls_timeout_and_encoded_query(monkeypatch):
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, size):
            captured["size"] = size
            return json.dumps({"results": [item()]}).encode()

    def open_request(request, **kwargs):
        captured.update(kwargs)
        captured["url"] = request.full_url
        return Response()

    monkeypatch.setattr(geocoding, "urlopen", open_request)
    query = "Paris &name=http://127.0.0.1"
    assert geocoding.fetch_json(query)["results"]
    parsed = urlparse(captured["url"])
    assert parsed.netloc == "geocoding-api.open-meteo.com"
    assert parse_qs(parsed.query)["name"] == [query]
    assert captured["context"].verify_mode == ssl.CERT_REQUIRED
    assert captured["context"].check_hostname
    assert captured["timeout"] == 5 and captured["size"] == 65537


@pytest.mark.parametrize("status", [429, 500])
def test_upstream_errors_are_safe_and_not_cached(monkeypatch, status):
    def failed(*args, **kwargs):
        raise HTTPError("ignored", status, "upstream private error", {}, None)

    monkeypatch.setattr(geocoding, "urlopen", failed)
    with pytest.raises(GeocodingFailure) as error:
        geocoding.fetch_json("Kyoto")
    assert error.value.status == (429 if status == 429 else 503)
    assert "private" not in error.value.code


def test_unavailable_network_is_a_safe_failure(monkeypatch):
    def failed(*args, **kwargs):
        raise URLError("private network detail")

    monkeypatch.setattr(geocoding, "urlopen", failed)
    with pytest.raises(GeocodingFailure) as error:
        geocoding.fetch_json("Kyoto")
    assert error.value.code == "PLACE_PROVIDER_UNAVAILABLE"


def test_rate_limit_header_and_private_error_response(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(settings, "place_search_enabled", True)

    def busy(q):
        raise GeocodingFailure("PLACE_SEARCH_RATE_LIMITED", 429)

    monkeypatch.setattr(destinations, "geocoder", SimpleNamespace(search=busy))
    with TestClient(app) as client:
        response = client.get("/api/v1/destinations/search?q=Kyoto")
        assert response.status_code == 429
        assert response.headers["retry-after"] == "60"
        assert response.headers["cache-control"] == "private, no-store"
