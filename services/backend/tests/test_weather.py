from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest
import test_activity_discovery
import test_trips

from app.api import weather
from app.providers.weather import WeatherFailure, WeatherProvider

TODAY = date(2026, 11, 14)


def payload():
    return {
        "latitude": 35.02,
        "longitude": 135.75,
        "timezone": "Asia/Tokyo",
        "daily_units": {
            "weather_code": "wmo code",
            "temperature_2m_min": "°C",
            "temperature_2m_max": "°C",
            "precipitation_sum": "mm",
            "precipitation_probability_max": "%",
        },
        "daily": {
            "time": ["2026-11-14", "2026-11-15"],
            "weather_code": [0, 61],
            "temperature_2m_min": [10, None],
            "temperature_2m_max": [20, None],
            "precipitation_sum": [0, None],
            "precipitation_probability_max": [0, None],
        },
    }


def test_zero_and_missing_values_remain_distinct_and_cache_is_not_mutable():
    calls = []
    provider = WeatherProvider(
        lambda *args: calls.append(args) or payload(), clock=lambda: 0
    )
    first = provider.forecast(35.02, 135.75, "Asia/Tokyo", TODAY)
    assert first.days[0].weather_code == 0 and first.days[0].precipitation_mm == 0
    assert first.days[1].precipitation_mm is None
    first.days.clear()
    second = provider.forecast(35.02, 135.75, "Asia/Tokyo", TODAY)
    assert second.cached and len(second.days) == 2 and len(calls) == 1


@pytest.mark.parametrize(
    "change",
    [
        "units",
        "length",
        "nan",
        "bool",
        "inverted",
        "duplicate",
        "past",
        "far",
        "timezone",
        "grid",
    ],
)
def test_malformed_or_mismatched_provider_data_is_not_a_forecast(change):
    value = payload()
    if change == "units":
        value["daily_units"]["precipitation_sum"] = "inch"
    if change == "length":
        value["daily"]["weather_code"] = []
    if change == "nan":
        value["daily"]["temperature_2m_min"][0] = float("nan")
    if change == "bool":
        value["daily"]["precipitation_probability_max"][0] = True
    if change == "inverted":
        value["daily"]["temperature_2m_min"][0] = 30
    if change == "duplicate":
        value["daily"]["time"][1] = "2026-11-14"
    if change == "past":
        value["daily"]["time"][0] = "2026-11-13"
    if change == "far":
        value["daily"]["time"][1] = "2027-01-01"
    if change == "timezone":
        value["timezone"] = "America/New_York"
    if change == "grid":
        value["latitude"] = 0
    with pytest.raises(WeatherFailure):
        WeatherProvider(lambda *args: value).forecast(
            35.02, 135.75, "Asia/Tokyo", TODAY
        )


def test_provider_limits_and_cache_expiry():
    clock = [0]
    calls = []
    provider = WeatherProvider(
        lambda *a: calls.append(a) or payload(), clock=lambda: clock[0]
    )
    provider.forecast(35.02, 135.75, "Asia/Tokyo", TODAY)
    clock[0] = 901
    assert not provider.forecast(35.02, 135.75, "Asia/Tokyo", TODAY).cached
    assert len(calls) == 2
    provider.calls.extend([901] * 6)
    with pytest.raises(WeatherFailure) as error:
        provider.forecast(35.021, 135.75, "Asia/Tokyo", TODAY)
    assert error.value.status == 429 and len(calls) == 2
    provider.calls.clear()
    provider.slots.acquire()
    provider.slots.acquire()
    with pytest.raises(WeatherFailure) as error:
        provider.forecast(35.021, 135.75, "Asia/Tokyo", TODAY)
    assert error.value.code == "WEATHER_BUSY"


def test_local_day_boundary_missing_date_and_distant_dates_do_not_call_provider():
    class Fail:
        def forecast(self, *args):
            pytest.fail("No provider call expected")

    ref = SimpleNamespace(payload={"timezone": "Asia/Tokyo"})
    now = datetime(2026, 11, 13, 23, tzinfo=timezone.utc)
    result = weather.weather_view(ref, None, Fail(), now)
    assert result.status == "date_needed" and result.horizon_start == TODAY
    for d in [date(2026, 11, 13), date(2027, 1, 1)]:
        result = weather.weather_view(ref, d, Fail(), now)
        assert result.status == "outside_forecast_window" and result.day is None


def test_actual_coverage_and_all_unknown_day_do_not_invent_weather():
    ref = SimpleNamespace(
        payload={"timezone": "Asia/Tokyo", "latitude": 35.02, "longitude": 135.75}
    )
    value = payload()
    for key in value["daily"]:
        if key != "time":
            value["daily"][key][1] = None
    provider = WeatherProvider(lambda *args: value)
    now = datetime(2026, 11, 14, tzinfo=timezone.utc)
    assert (
        weather.weather_view(ref, date(2026, 11, 15), provider, now).status
        == "not_covered"
    )
    result = weather.weather_view(ref, date(2026, 11, 16), provider, now)
    assert result.status == "not_covered" and result.coverage_end == date(2026, 11, 15)


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def test_public_weather_reference_validation_and_no_store(context, monkeypatch):
    client, _, _ = context
    destination, _ = test_activity_discovery.discovered(client, monkeypatch)

    class Fail:
        def forecast(self, *args):
            pytest.fail("Out of horizon or absent date must not call provider")

    monkeypatch.setattr(weather, "weather_provider", Fail())
    base = f"/api/v1/weather?destination_reference_id={destination['reference_id']}"
    response = client.get(base)
    assert (
        response.status_code == 200
        and response.json()["data"]["status"] == "date_needed"
    )
    assert response.headers["cache-control"] == "private, no-store"
    assert (
        client.get(base + "&visit_date=2099-01-01").json()["data"]["status"]
        == "outside_forecast_window"
    )
    assert client.get(base + "&visit_date=bad").status_code == 422
    assert (
        client.get(
            "/api/v1/weather?destination_reference_id=00000000-0000-0000-0000-000000000001"
        ).status_code
        == 404
    )


def test_transport_is_bounded_and_does_not_send_private_trip_data(monkeypatch):
    import json
    from urllib.parse import parse_qs, urlparse

    from app.providers import weather as transport

    captured = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, size):
            assert size == 65537
            return json.dumps(payload()).encode()

    def fetch(request, **options):
        captured.append((request, options))
        return Response()

    monkeypatch.setattr(transport, "urlopen", fetch)
    transport.fetch_weather(35.02, 135.75, "Asia/Tokyo")
    request, options = captured[0]
    query = parse_qs(urlparse(request.full_url).query)
    assert query["forecast_days"] == ["16"] and query["timezone"] == ["Asia/Tokyo"]
    assert set(query) == {
        "latitude",
        "longitude",
        "timezone",
        "forecast_days",
        "temperature_unit",
        "precipitation_unit",
        "daily",
    }
    assert options["timeout"] == 8 and options["context"].check_hostname


def test_api_live_shape_and_outage_are_distinct(context, monkeypatch):
    from app.api import weather as api

    client, _, _ = context
    destination, _ = test_activity_discovery.discovered(client, monkeypatch)

    class Clock(datetime):
        @classmethod
        def now(cls, *args):
            return datetime(2026, 11, 14, tzinfo=timezone.utc)

    monkeypatch.setattr(api, "datetime", Clock)
    monkeypatch.setattr(
        api, "weather_provider", WeatherProvider(lambda *args: payload())
    )
    url = f"/api/v1/weather?destination_reference_id={destination['reference_id']}&visit_date=2026-11-14"
    response = client.get(url)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["status"] == "forecast" and data["day"]["precipitation_mm"] == 0
    assert data["retrieved_at"] and data["source"] == "Open-Meteo"

    class Failed:
        def forecast(self, *args):
            raise WeatherFailure("WEATHER_RATE_LIMITED", 429)

    monkeypatch.setattr(api, "weather_provider", Failed())
    response = client.get(url)
    assert response.status_code == 429 and response.headers["retry-after"] == "60"
    assert (
        response.json()["code"] == "WEATHER_RATE_LIMITED"
        and "data" not in response.json()
    )
