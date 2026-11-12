import json
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

import pytest
from pydantic import SecretStr

from app.config import settings
from app.providers import geoapify
from app.providers.activities import ActivityDiscovery, DiscoveryFailure


def feature():
    return {
        "properties": {
            "place_id": "51abc123",
            "name": "Hosted museum",
            "categories": ["entertainment.museum"],
            "lat": 35.02,
            "lon": 135.75,
        }
    }


def test_hosted_transport_is_bounded_attributed_and_keeps_key_out_of_results(
    monkeypatch,
):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, size):
            captured["size"] = size
            return json.dumps({"features": [feature()]}).encode()

    def fetch(request, **options):
        captured.update(options, url=request.full_url)
        return Response()

    monkeypatch.setattr(geoapify, "urlopen", fetch)
    page = ActivityDiscovery(geoapify.fetch_geoapify).search(35.02, 135.75, "museum")
    parsed = urlparse(captured["url"])
    params = parse_qs(parsed.query)
    assert parsed.netloc == "api.geoapify.com"
    assert params["limit"] == ["12"] and params["filter"] == [
        "circle:135.750000,35.020000,5000"
    ]
    assert (
        captured["size"] == 131073
        and captured["timeout"] == 8
        and captured["context"].check_hostname
    )
    assert page.source == "Geoapify / OpenStreetMap contributors"
    assert page.results[0].external_id == "geoapify/51abc123"
    assert "test-secret" not in page.model_dump_json()


@pytest.mark.parametrize(
    "status,code",
    [
        (401, "ACTIVITY_PROVIDER_AUTH_FAILED"),
        (403, "ACTIVITY_PROVIDER_AUTH_FAILED"),
        (429, "ACTIVITY_PROVIDER_RATE_LIMITED"),
        (500, "ACTIVITY_PROVIDER_UNAVAILABLE"),
    ],
)
def test_hosted_errors_do_not_expose_key_or_upstream_body(monkeypatch, status, code):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))

    def failed(*args, **kwargs):
        raise HTTPError(
            "https://private?apiKey=test-secret", status, "private", {}, None
        )

    monkeypatch.setattr(geoapify, "urlopen", failed)
    with pytest.raises(DiscoveryFailure) as failure:
        geoapify.fetch_geoapify(35, 135, "museum")
    assert failure.value.code == code
    assert "test-secret" not in str(failure.value)


def test_hosted_provider_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr(""))
    with pytest.raises(DiscoveryFailure, match="ACTIVITY_PROVIDER_NOT_CONFIGURED"):
        geoapify.fetch_geoapify(35, 135, "museum")
