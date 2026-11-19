import json
from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from urllib.error import HTTPError

import pytest
import test_activity_discovery
import test_trips
from pydantic import SecretStr

from app.api import place_checks
from app.api.identity import verified_identity
from app.config import settings
from app.main import app
from app.planning.opening_hours import check_hours
from app.providers import geoapify_checks as transport
from app.providers.geoapify_checks import (
    CheckFailure,
    GeoapifyChecks,
    PlaceHours,
    parse_place_hours,
    place_lookup,
)

NOW = datetime(2026, 11, 19, 12, 0, tzinfo=timezone.utc)
LA = "America/Los_Angeles"

# Strings copied from live Geoapify responses for San Francisco museums.
COUNTERCULTURE = "Mo-Tu off; We-Su 11:00-18:00"
RANDALL = "Tu-Sa 10:00-17:00; Jan 1 off; Jun 19 off; Jul 4 off; Nov 11 off; Nov Th[4] off; Nov Th[4] +1 day off; Dec 25 off"
MARITIME = "We-Su,PH 10:00-16:00; Mo-Tu off; Jan 01 off; Nov Th[4] off; Dec 25 off"
GLBT = "11:00-18:00; Su 12:00-17:00; Tu closed"
EXPLORATORIUM = "Tu-Su 10:00-17:00; Jun 19 - Sep 4 Mo-Su 10:00-17:00, Fr 10:00-21:00"
SFMOMA = "Mo-Tu,Fr-Su 10:00-17:00; Th 12:00-20:00; May 27-Sep 4 10:00-20:00; Dec 25 off"


def hours(rules, day, start, minutes=60, country=None, now=NOW, zone=LA):
    return check_hours(
        rules,
        day,
        time.fromisoformat(start),
        minutes,
        zone,
        now,
        country,
        (37.77, -122.42),
    )[0]


@pytest.mark.parametrize(
    "rules,day,start,minutes,expected",
    [
        # Wed 25 Nov 2026
        (COUNTERCULTURE, date(2026, 11, 25), "14:00", 60, "fits_reported_hours"),
        (COUNTERCULTURE, date(2026, 11, 25), "17:30", 60, "outside_reported_hours"),
        (COUNTERCULTURE, date(2026, 11, 25), "10:30", 60, "outside_reported_hours"),
        (COUNTERCULTURE, date(2026, 11, 25), "08:00", 60, "outside_reported_hours"),
        (COUNTERCULTURE, date(2026, 11, 23), "14:00", 60, "outside_reported_hours"),
        # Randall: fourth Thursday (Thanksgiving) is closed, other Wednesdays open
        (RANDALL, date(2026, 11, 25), "11:00", 60, "fits_reported_hours"),
        (RANDALL, date(2026, 11, 26), "11:00", 60, "outside_reported_hours"),
        (RANDALL, date(2026, 12, 25), "11:00", 60, "outside_reported_hours"),
        # Later rules override earlier ones
        (GLBT, date(2026, 11, 24), "13:00", 60, "outside_reported_hours"),
        (GLBT, date(2026, 11, 29), "12:30", 60, "fits_reported_hours"),
        (GLBT, date(2026, 11, 29), "11:30", 60, "outside_reported_hours"),
        # Seasonal date range with a Friday override
        (EXPLORATORIUM, date(2027, 7, 2), "20:00", 60, "fits_reported_hours"),
        # A comma adds a rule instead of limiting it to the date range, so the
        # late Friday applies all year while other evenings stay closed.
        (EXPLORATORIUM, date(2026, 11, 27), "20:00", 60, "fits_reported_hours"),
        (EXPLORATORIUM, date(2026, 11, 26), "20:00", 60, "outside_reported_hours"),
        (SFMOMA, date(2026, 11, 26), "13:00", 60, "fits_reported_hours"),
        (SFMOMA, date(2026, 11, 25), "13:00", 60, "outside_reported_hours"),
        ("24/7", date(2026, 12, 3), "03:00", 120, "fits_reported_hours"),
        # Overnight rule crossing midnight
        ("Mo-Su 18:00-02:00", date(2026, 11, 25), "23:00", 120, "fits_reported_hours"),
        (
            "Mo-Su 18:00-02:00",
            date(2026, 11, 25),
            "23:00",
            240,
            "outside_reported_hours",
        ),
    ],
)
def test_whole_visit_is_compared_with_regular_osm_hours(
    rules, day, start, minutes, expected
):
    assert hours(rules, day, start, minutes) == expected


def test_public_holidays_need_a_country_and_are_never_silently_ignored():
    thanksgiving = date(2026, 11, 26)
    rules = "Mo-Fr 09:00-17:00; PH off"
    assert hours(rules, thanksgiving, "11:00") == "hours_unknown"
    assert hours(rules, thanksgiving, "11:00", country="US") == "outside_reported_hours"
    assert hours(rules, date(2026, 11, 25), "11:00", country="US") == (
        "fits_reported_hours"
    )
    assert hours(rules, thanksgiving, "11:00", country="ZZ") == "hours_unknown"
    # Holiday-aware rules with a country still honour explicit closure rules.
    assert hours(MARITIME, date(2026, 12, 25), "12:00", country="US") == (
        "outside_reported_hours"
    )


@pytest.mark.parametrize(
    "rules",
    [
        None,
        "",
        "   ",
        "by appointment ???",
        "Mo-Fr 09:00-17:00 unknown",
        'Mo-Fr 10:00-12:00 open "call first"',
        "Mo-Fr 09:00-17:00; SH off",
        "Mo-Fr sunrise-sunset" + "\x00",
    ],
)
def test_uninterpretable_or_missing_hours_are_unknown_not_open(rules):
    assert hours(rules, date(2026, 11, 25), "11:00") == "hours_unknown"


def test_missing_and_unreadable_hours_use_distinct_wording():
    missing = check_hours(
        None, date(2026, 11, 25), time(11), 60, LA, NOW, None, (37.77, -122.42)
    )
    garbage = check_hours(
        "by appointment ???", date(2026, 11, 25), time(11), 60, LA, NOW, None, (1, 2)
    )
    assert "No opening hours are listed" in missing[1]
    assert "cannot interpret safely" in garbage[1]


def test_date_and_clock_edge_cases_are_not_guessed():
    assert hours(COUNTERCULTURE, None, "14:00") == "date_needed"
    assert hours(COUNTERCULTURE, date(2026, 11, 18), "14:00") == "outside_coverage"
    # A date earlier today in the venue's zone is still allowed.
    assert hours("24/7", date(2026, 11, 19), "14:00") == "fits_reported_hours"
    early = datetime(2026, 1, 15, tzinfo=timezone.utc)
    # 1 Nov 2026 01:30 happens twice in Los Angeles; 8 Mar 02:30 never happens.
    assert hours("24/7", date(2026, 11, 1), "01:30", now=early) == "hours_unknown"
    assert hours("24/7", date(2026, 3, 8), "02:30", now=early) == "hours_unknown"
    # A visit spanning a clock change cannot be compared safely either.
    assert hours("24/7", date(2026, 3, 8), "01:00", 180, now=early) == "hours_unknown"


def test_sunrise_rules_use_the_venue_coordinates():
    assert hours("Mo-Su sunrise-sunset", date(2026, 11, 25), "11:00") == (
        "fits_reported_hours"
    )
    assert hours("Mo-Su sunrise-sunset", date(2026, 11, 25), "23:00") == (
        "outside_reported_hours"
    )


def test_every_answer_is_labeled_unverified():
    for rules in (COUNTERCULTURE, RANDALL):
        for day in (date(2026, 11, 25), date(2026, 11, 26)):
            _, message = check_hours(
                rules, day, time(11), 60, LA, NOW, None, (37.77, -122.42)
            )
            assert "not verified" in message and "OpenStreetMap" in message


# ---- provider boundary -----------------------------------------------------


def detail(**props):
    base = {
        "feature_type": "details",
        "name": "Museum",
        "lat": 37.78,
        "lon": -122.4,
        "opening_hours": "Tu-Su 10:00-17:00",
        "country_code": "us",
    }
    return {"features": [{"properties": {**base, **props}}]}


def test_source_ids_map_to_place_details_parameters_only():
    assert place_lookup("geoapify/abc_DEF-123") == {"id": "abc_DEF-123"}
    assert place_lookup("node/100") == {"osm_type": "n", "osm_id": "100"}
    assert place_lookup("way/7") == {"osm_type": "w", "osm_id": "7"}
    assert place_lookup("relation/9") == {"osm_type": "r", "osm_id": "9"}
    for bad in (None, "", 5, "node/0", "node/1&x=2", "geoapify/", "other/1", "x" * 600):
        with pytest.raises(CheckFailure) as failure:
            place_lookup(bad)
        assert failure.value.code == "PLACE_HOURS_NOT_FOUND"


def test_place_details_are_validated_and_normalized():
    place = parse_place_hours(detail())
    assert place == PlaceHours("Museum", 37.78, -122.4, "Tu-Su 10:00-17:00", "US")
    assert parse_place_hours(detail(opening_hours=None)).opening_hours is None
    assert parse_place_hours(detail(opening_hours="  ")).opening_hours is None
    assert parse_place_hours(detail(country_code=None)).country_code is None
    other = {
        "features": [
            {"properties": {"feature_type": "building"}},
            detail()["features"][0],
        ]
    }
    assert parse_place_hours(other).name == "Museum"


@pytest.mark.parametrize(
    "data",
    [
        {"features": "x"},
        {"features": [{}]},
        detail(lat="1"),
        detail(lat=True),
        detail(lat=91),
        detail(lon=float("nan")),
        detail(name=5),
        detail(opening_hours=5),
        detail(opening_hours="x" * 2001),
        detail(country_code="USA"),
        {},
    ],
)
def test_malformed_place_details_fail_closed(data):
    with pytest.raises(CheckFailure) as failure:
        parse_place_hours(data)
    assert failure.value.code == "PLACE_HOURS_UNAVAILABLE"


def test_place_without_a_details_feature_is_not_found():
    with pytest.raises(CheckFailure) as failure:
        parse_place_hours({"features": []})
    assert (failure.value.code, failure.value.status) == ("PLACE_HOURS_NOT_FOUND", 404)


class Response:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self, size):
        return json.dumps(self.body).encode()


def test_hours_request_uses_place_details_and_only_the_details_feature(monkeypatch):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    seen = []

    def fetch(request, **options):
        seen.append((request, options))
        return Response(detail())

    monkeypatch.setattr(transport, "urlopen", fetch)
    client = GeoapifyChecks()
    assert client.place_hours("owner", "geoapify/abc").opening_hours
    client.place_hours("owner", "node/100")
    first = seen[0][0].full_url
    assert first.startswith("https://api.geoapify.com/v2/place-details?")
    assert "id=abc" in first and "features=details" in first
    assert "osm_type=n" in seen[1][0].full_url and "osm_id=100" in seen[1][0].full_url
    assert seen[0][1]["timeout"] == 8 and seen[0][1]["context"].check_hostname


@pytest.mark.parametrize(
    "status,code",
    [
        (403, "PLACE_HOURS_ACCESS_DENIED"),
        (404, "PLACE_HOURS_NOT_FOUND"),
        (429, "PLACE_HOURS_RATE_LIMITED"),
        (500, "PLACE_HOURS_UNAVAILABLE"),
    ],
)
def test_hours_errors_do_not_expose_credential_or_response(monkeypatch, status, code):
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))

    def failed(*args, **kwargs):
        raise HTTPError("https://x/?apiKey=test-secret", status, "private", {}, None)

    monkeypatch.setattr(transport, "urlopen", failed)
    with pytest.raises(CheckFailure) as failure:
        GeoapifyChecks().place_hours("owner", "node/100")
    assert failure.value.code == code and "test-secret" not in str(failure.value)


def test_hours_not_configured_and_quota_make_no_upstream_call(monkeypatch):
    monkeypatch.setattr(
        transport, "urlopen", lambda *a, **k: pytest.fail("must not call upstream")
    )
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr(""))
    with pytest.raises(CheckFailure, match="PLACE_HOURS_NOT_CONFIGURED"):
        GeoapifyChecks().place_hours("owner", "node/100")
    monkeypatch.setattr(settings, "geoapify_api_key", SecretStr("test-secret"))
    client = GeoapifyChecks(clock=lambda: 0)
    client.calls.extend([0] * 6)
    with pytest.raises(CheckFailure, match="PLACE_HOURS_RATE_LIMITED"):
        client.place_hours("owner", "node/100")


# ---- endpoint --------------------------------------------------------------


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def post(client, source, **overrides):
    body = {
        "source_place_id": source["id"],
        "visit_date": (date.today() + timedelta(days=3)).isoformat(),
        "start": "10:00",
        "duration_minutes": 60,
        **overrides,
    }
    return client.post("/api/v1/place-checks/hours", json=body)


def fake(monkeypatch, place=None, error=None):
    calls = []

    def place_hours(owner, external_id):
        calls.append((owner, external_id))
        if error:
            raise error
        return place or PlaceHours(
            "Mapped museum", 35.02, 135.75, "Mo-Su 09:00-17:00", "JP"
        )

    monkeypatch.setattr(
        place_checks, "geoapify_checks", SimpleNamespace(place_hours=place_hours)
    )
    return calls


def test_endpoint_checks_the_retained_place_and_saves_nothing(context, monkeypatch):
    client, db, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    calls = fake(monkeypatch)
    response = post(client, source)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    result = response.json()["data"]
    assert result["status"] == "fits_reported_hours"
    assert (
        result["hours"] == ["Mo-Su 09:00-17:00"] and result["hours_basis"] == "regular"
    )
    assert result["source"] == "Geoapify / OpenStreetMap contributors"
    assert result["place_name"] == "Mapped museum"
    assert calls and calls[0][1] == source["external_id"] == "node/100"
    assert len(db.new) == 0 and len(db.dirty) == 0
    assert post(client, source, start="18:00").json()["data"]["status"] == (
        "outside_reported_hours"
    )
    assert post(client, source, visit_date=None).json()["data"]["status"] == (
        "date_needed"
    )


def test_missing_hours_are_reported_as_unavailable(context, monkeypatch):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    fake(monkeypatch, PlaceHours("Mapped museum", 35.02, 135.75, None, "JP"))
    result = post(client, source).json()["data"]
    assert result["status"] == "hours_unknown"
    assert result["hours"] == [] and result["hours_basis"] == "unavailable"


def test_endpoint_rejects_a_place_that_moved_far_from_the_selection(
    context, monkeypatch
):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    fake(monkeypatch, PlaceHours("Elsewhere", 35.5, 135.75, "24/7", "JP"))
    response = post(client, source)
    assert response.status_code == 422
    assert response.json()["code"] == "PLACE_LOCATION_MISMATCH"


@pytest.mark.parametrize(
    "error,status,code",
    [
        (CheckFailure("PLACE_HOURS_ACCESS_DENIED"), 503, "PLACE_HOURS_ACCESS_DENIED"),
        (CheckFailure("PLACE_HOURS_NOT_FOUND", 404), 404, "PLACE_HOURS_NOT_FOUND"),
        (
            CheckFailure("PLACE_HOURS_RATE_LIMITED", 429),
            429,
            "PLACE_HOURS_RATE_LIMITED",
        ),
    ],
)
def test_provider_failures_become_safe_codes(context, monkeypatch, error, status, code):
    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    fake(monkeypatch, error=error)
    response = post(client, source)
    assert response.status_code == status and response.json()["code"] == code
    assert ("retry-after" in response.headers) == (status == 429)


def test_endpoint_needs_auth_and_a_known_source(context, monkeypatch):
    from uuid import uuid4

    client, _, _ = context
    _, source = test_activity_discovery.discovered(client, monkeypatch)
    calls = fake(monkeypatch)
    assert post(client, {"id": str(uuid4())}).status_code == 404
    assert post(client, source, duration_minutes=0).status_code == 422
    assert post(client, source, extra="x").status_code == 422
    app.dependency_overrides.pop(verified_identity)
    assert post(client, source).status_code == 401
    assert calls == []
