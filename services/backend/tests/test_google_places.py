import json
from datetime import date, datetime, time, timezone
from urllib.error import HTTPError
from uuid import uuid4

import pytest
import test_activity_discovery
import test_proposals
import test_trips
from pydantic import SecretStr

from app.api import google_places
from app.api.identity import verified_identity
from app.config import settings
from app.main import app
from app.planning.opening_hours import check_hours
from app.providers import google_places as transport
from app.providers.google_places import GoogleFailure, GoogleMatch, GooglePlaces

STAMP = datetime(2026, 11, 11, 8, tzinfo=timezone.utc)


def period(day=11, start=9, end=17):
    return {
        "open": {
            "date": {"year": 2026, "month": 11, "day": day},
            "hour": start,
            "minute": 0,
        },
        "close": {
            "date": {"year": 2026, "month": 11, "day": day},
            "hour": end,
            "minute": 0,
        },
    }


@pytest.mark.parametrize(
    "visit,start,minutes,hours,business,status",
    [
        (None, "10:00", 60, {}, None, "date_needed"),
        (date(2026, 12, 1), "10:00", 60, {}, None, "outside_coverage"),
        (date(2026, 11, 11), "10:00", 60, {}, None, "hours_unknown"),
        (date(2026, 11, 11), "10:00", 60, {"periods": []}, None, "hours_unknown"),
        (
            date(2026, 11, 11),
            "10:00",
            60,
            {"periods": [period()]},
            None,
            "fits_reported_hours",
        ),
        (
            date(2026, 11, 11),
            "16:30",
            60,
            {"periods": [period()]},
            None,
            "outside_reported_hours",
        ),
        (
            date(2026, 11, 11),
            "17:00",
            60,
            {"periods": [period()]},
            None,
            "outside_reported_hours",
        ),
        (
            date(2026, 11, 11),
            "16:00",
            60,
            {"periods": [period()]},
            None,
            "fits_reported_hours",
        ),
        (
            date(2026, 11, 12),
            "10:00",
            60,
            {"periods": [period()]},
            None,
            "outside_reported_hours",
        ),
        (
            date(2026, 11, 11),
            "10:00",
            60,
            {"periods": [period()]},
            "CLOSED_TEMPORARILY",
            "reported_closed",
        ),
        (
            date(2026, 11, 11),
            "10:00",
            60,
            {"periods": [{"open": {"day": 0, "hour": 0, "minute": 0}}]},
            None,
            "fits_reported_hours",
        ),
        (
            date(2026, 11, 11),
            "10:00",
            60,
            {"periods": [{"open": {"day": 3, "hour": 9}}]},
            None,
            "hours_unknown",
        ),
        (
            date(2026, 11, 11),
            "11:30",
            120,
            {"periods": [period(start=9, end=12), period(start=13, end=17)]},
            None,
            "outside_reported_hours",
        ),
        (
            date(2026, 11, 11),
            "11:30",
            120,
            {"periods": [period(start=9, end=12), period(start=12, end=17)]},
            None,
            "fits_reported_hours",
        ),
    ],
)
def test_whole_visit_uses_dated_current_hours(
    visit, start, minutes, hours, business, status
):
    details = {"currentOpeningHours": hours, "businessStatus": business}
    assert (
        check_hours(
            details, visit, time.fromisoformat(start), minutes, "Asia/Kolkata", STAMP
        )[0]
        == status
    )


def test_overnight_and_timezone_day_boundary():
    overnight = {
        "open": {"date": {"year": 2026, "month": 11, "day": 11}, "hour": 22},
        "close": {"date": {"year": 2026, "month": 11, "day": 12}, "hour": 2},
    }
    assert (
        check_hours(
            {"currentOpeningHours": {"periods": [overnight]}},
            date(2026, 11, 11),
            time(23),
            120,
            "Asia/Kolkata",
            STAMP,
        )[0]
        == "fits_reported_hours"
    )
    # Local date, not the UTC calendar date, determines the coverage window.
    boundary = datetime(2026, 11, 10, 23, tzinfo=timezone.utc)
    assert (
        check_hours({}, date(2026, 11, 10), time(23), 30, "Asia/Tokyo", boundary)[0]
        == "outside_coverage"
    )


def test_google_transport_uses_header_key_allowlisted_fields_and_no_cache(monkeypatch):
    monkeypatch.setattr(settings, "google_maps_api_key", SecretStr("test-secret"))
    captured = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, size):
            assert size == 131073
            return json.dumps(
                {
                    "places": [
                        {
                            "id": "ChIJ_test",
                            "displayName": {"text": "Museum"},
                            "location": {"latitude": 35, "longitude": 135},
                        }
                    ]
                }
            ).encode()

    def fetch(request, **options):
        captured.append((request, options))
        return Response()

    monkeypatch.setattr(transport, "urlopen", fetch)
    client = GooglePlaces()
    assert client.matches("owner", "Museum", 35, 135)[0].id == "ChIJ_test"
    assert client.matches("owner", "Museum", 35, 135)[0].id == "ChIJ_test"
    assert len(captured) == 2
    request, options = captured[0]
    assert "test-secret" not in request.full_url
    assert request.get_header("X-goog-api-key") == "test-secret"
    assert "reviews" not in request.get_header("X-goog-fieldmask")
    assert options["context"].check_hostname and options["timeout"] == 8


@pytest.mark.parametrize(
    "status,code",
    [
        (403, "GOOGLE_PLACES_ACCESS_DENIED"),
        (429, "GOOGLE_PLACES_RATE_LIMITED"),
        (500, "GOOGLE_PLACES_UNAVAILABLE"),
    ],
)
def test_google_errors_do_not_expose_credential_or_response(monkeypatch, status, code):
    monkeypatch.setattr(settings, "google_maps_api_key", SecretStr("test-secret"))

    def failed(*args, **kwargs):
        raise HTTPError("private", status, "private", {}, None)

    monkeypatch.setattr(transport, "urlopen", failed)
    with pytest.raises(GoogleFailure) as failure:
        GooglePlaces().matches("owner", "Museum", 35, 135)
    assert failure.value.code == code and "test-secret" not in str(failure.value)


def test_google_quota_and_concurrency_do_not_call_upstream(monkeypatch):
    monkeypatch.setattr(settings, "google_maps_api_key", SecretStr("test-secret"))
    client = GooglePlaces(clock=lambda: 0)
    client.calls.extend([0] * 6)
    with pytest.raises(GoogleFailure, match="GOOGLE_PLACES_RATE_LIMITED"):
        client.matches("owner", "Museum", 35, 135)
    client = GooglePlaces()
    client.slots.acquire()
    client.slots.acquire()
    with pytest.raises(GoogleFailure, match="GOOGLE_PLACES_BUSY"):
        client.matches("owner", "Museum", 35, 135)


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def test_google_check_auth_matching_no_snapshot_and_identifier_roundtrip(
    context, monkeypatch
):
    client, db, _ = context
    destination, source = test_activity_discovery.discovered(client, monkeypatch)
    record = {
        "id": "ChIJ_test",
        "displayName": {"text": "Mapped museum"},
        "formattedAddress": "Test address",
        "location": {"latitude": 35.02, "longitude": 135.75},
        "regularOpeningHours": {"weekdayDescriptions": ["Monday: 9–17"]},
        "priceLevel": "PRICE_LEVEL_MODERATE",
    }

    class Fake:
        def matches(self, *args):
            return [
                GoogleMatch(
                    id="ChIJ_test",
                    name="Mapped museum",
                    address="Test address",
                    latitude=35.02,
                    longitude=135.75,
                ),
                GoogleMatch(
                    id="ChIJ_far",
                    name="Distant namesake",
                    address="Far",
                    latitude=0,
                    longitude=0,
                ),
            ]

        def details(self, *args):
            return record

    monkeypatch.setattr(google_places, "google_places", Fake())
    matched = client.post(
        "/api/v1/google-places/matches", json={"source_place_id": source["id"]}
    )
    assert matched.status_code == 200, matched.text
    assert matched.headers["cache-control"] == "private, no-store"
    assert [p["id"] for p in matched.json()["data"]] == ["ChIJ_test"]
    check = client.post(
        "/api/v1/google-places/check",
        json={
            "source_place_id": source["id"],
            "google_place_id": "ChIJ_test",
            "start": "10:00",
            "duration_minutes": 60,
        },
    )
    assert check.status_code == 200, check.text
    assert check.json()["data"]["status"] == "date_needed"
    stop = str(uuid4())
    plan = {
        "stops": [
            {
                "client_id": stop,
                "name": destination["label"],
                "timezone": destination["timezone"],
                "place_reference_id": destination["reference_id"],
                "desired_nights": 3,
            }
        ],
        "activities": [
            {
                "logical_id": str(uuid4()),
                "stop_logical_id": stop,
                "user_label": source["name"],
                "place_id": source["id"],
                "google_place_id": "ChIJ_test",
                "local_day_offset": 0,
                "local_start_time": "10:00",
                "duration_minutes": 60,
            }
        ],
    }
    saved = client.post(
        "/api/v1/trips", json={"title": "Google ID check", "plan": plan}
    ).json()["data"]
    base = f"/api/v1/trips/{saved['id']}"
    loaded = client.get(f"{base}/versions/{saved['draft_version_id']}")
    data = loaded.json()["data"]
    assert data["activities"][0]["google_place_id"] == "ChIJ_test"
    assert "Test address" not in json.dumps(data)
    assert "weekdayDescriptions" not in json.dumps(data)
    proposal = test_proposals.submit(client, base, loaded.headers["etag"]).json()[
        "data"
    ]
    assert proposal["plan"]["activities"][0]["google_place_id"] == "ChIJ_test"
    assert test_proposals.accept(client, base, proposal).status_code == 200
    app.dependency_overrides.pop(verified_identity)
    assert (
        client.post(
            "/api/v1/google-places/matches", json={"source_place_id": source["id"]}
        ).status_code
        == 401
    )


def test_google_check_rejects_distant_listing_and_bad_identifiers(context, monkeypatch):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)

    class Fake:
        def details(self, *args):
            return {
                "id": "ChIJ_far",
                "displayName": {"text": "Far"},
                "location": {"latitude": 0, "longitude": 0},
            }

    monkeypatch.setattr(google_places, "google_places", Fake())
    body = {
        "source_place_id": source["id"],
        "google_place_id": "ChIJ_far",
        "start": "10:00",
        "duration_minutes": 60,
    }
    assert (
        client.post("/api/v1/google-places/check", json=body).json()["code"]
        == "GOOGLE_PLACE_LOCATION_MISMATCH"
    )
    assert (
        client.post(
            "/api/v1/google-places/check", json={**body, "google_place_id": "../secret"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/google-places/check", json={**body, "duration_minutes": 0}
        ).status_code
        == 422
    )


def test_closure_is_visible_without_dates_and_dst_is_not_silently_assumed():
    assert (
        check_hours(
            {"businessStatus": "CLOSED_PERMANENTLY"},
            None,
            time(10),
            60,
            "Asia/Kolkata",
            STAMP,
        )[0]
        == "reported_closed"
    )
    changed = {
        "currentOpeningHours": {
            "periods": [
                {
                    "open": {"date": {"year": 2026, "month": 10, "day": 25}, "hour": 0},
                    "close": {
                        "date": {"year": 2026, "month": 10, "day": 25},
                        "hour": 6,
                    },
                }
            ]
        }
    }
    assert (
        check_hours(
            changed,
            date(2026, 10, 25),
            time(1, 30),
            60,
            "Europe/London",
            datetime(2026, 10, 24, tzinfo=timezone.utc),
        )[0]
        == "hours_unknown"
    )
