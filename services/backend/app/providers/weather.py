"""Bounded, attributed forecast evidence; no itinerary or device location input."""

import json
import math
import ssl
import threading
import time
from collections import OrderedDict, deque
from datetime import date, datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import certifi

from app.providers.activities import distance
from app.trips.schemas import StrictModel


class WeatherFailure(Exception):
    def __init__(self, code="WEATHER_UNAVAILABLE", status=503):
        self.code, self.status = code, status


class WeatherDay(StrictModel):
    date: date
    weather_code: int | None
    temperature_min_c: float | None
    temperature_max_c: float | None
    precipitation_mm: float | None
    precipitation_probability_percent: float | None


class Forecast(StrictModel):
    days: list[WeatherDay]
    retrieved_at: datetime
    cached: bool = False


def fetch_weather(latitude, longitude, zone):
    query = urlencode(
        {
            "latitude": latitude,
            "longitude": longitude,
            "timezone": zone,
            "forecast_days": 16,
            "temperature_unit": "celsius",
            "precipitation_unit": "mm",
            "daily": "weather_code,temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max",
        }
    )
    request = Request(
        "https://api.open-meteo.com/v1/forecast?" + query,
        headers={
            "Accept": "application/json",
            "User-Agent": "Elsewhere-local-prototype/0.1",
        },
    )
    try:
        with urlopen(
            request,
            timeout=8,
            context=ssl.create_default_context(cafile=certifi.where()),
        ) as response:
            body = response.read(65537)
        if len(body) > 65536:
            raise ValueError()
        return json.loads(body)
    except HTTPError as error:
        raise WeatherFailure(
            "WEATHER_RATE_LIMITED" if error.code == 429 else "WEATHER_UNAVAILABLE",
            429 if error.code == 429 else 503,
        ) from None
    except (URLError, TimeoutError, ValueError, OSError):
        raise WeatherFailure() from None


def normalize_weather(data, today):
    try:
        if not isinstance(data, dict) or data.get("error"):
            raise ValueError()
        daily, units = data["daily"], data["daily_units"]
        names = {
            "weather_code": ("wmo code", 0, 99),
            "temperature_2m_min": ("°C", -100, 70),
            "temperature_2m_max": ("°C", -100, 70),
            "precipitation_sum": ("mm", 0, 2000),
            "precipitation_probability_max": ("%", 0, 100),
        }
        dates = [date.fromisoformat(d) for d in daily["time"]]
        if (
            not 1 <= len(dates) <= 16
            or len(set(dates)) != len(dates)
            or dates != sorted(dates)
            or any(not today <= d <= today + timedelta(days=15) for d in dates)
        ):
            raise ValueError()
        for name, (unit, low, high) in names.items():
            values = daily[name]
            if (
                units[name] != unit
                or not isinstance(values, list)
                or len(values) != len(dates)
            ):
                raise ValueError()
            for value in values:
                if value is not None and (
                    type(value) not in (int, float)
                    or not math.isfinite(value)
                    or not low <= value <= high
                    or name == "weather_code"
                    and type(value) is not int
                ):
                    raise ValueError()
        result = []
        for i, day in enumerate(dates):
            low, high = daily["temperature_2m_min"][i], daily["temperature_2m_max"][i]
            if low is not None and high is not None and low > high:
                raise ValueError()
            result.append(
                WeatherDay(
                    date=day,
                    weather_code=daily["weather_code"][i],
                    temperature_min_c=low,
                    temperature_max_c=high,
                    precipitation_mm=daily["precipitation_sum"][i],
                    precipitation_probability_percent=daily[
                        "precipitation_probability_max"
                    ][i],
                )
            )
        return Forecast(days=result, retrieved_at=datetime.now(timezone.utc))
    except (KeyError, TypeError, ValueError, OverflowError):
        raise WeatherFailure() from None


class WeatherProvider:
    def __init__(self, transport=None, clock=time.monotonic):
        self.transport, self.clock = transport or fetch_weather, clock
        self.lock, self.slots = threading.Lock(), threading.BoundedSemaphore(2)
        self.calls, self.cache = deque(), OrderedDict()

    def forecast(self, latitude, longitude, zone, today):
        if (
            not all(
                type(v) in (int, float) and math.isfinite(v)
                for v in (latitude, longitude)
            )
            or abs(latitude) > 90
            or abs(longitude) > 180
        ):
            raise WeatherFailure()
        key, now = (latitude, longitude, zone, today), self.clock()
        with self.lock:
            cached = self.cache.get(key)
            if cached and now - cached[0] < 900:
                self.cache.move_to_end(key)
                return cached[1].model_copy(deep=True, update={"cached": True})
            while self.calls and now - self.calls[0] >= 86400:
                self.calls.popleft()
            if len(self.calls) >= 200 or sum(now - t < 60 for t in self.calls) >= 6:
                raise WeatherFailure("WEATHER_RATE_LIMITED", 429)
            if not self.slots.acquire(blocking=False):
                raise WeatherFailure("WEATHER_BUSY", 429)
            self.calls.append(now)
        try:
            data = self.transport(latitude, longitude, zone)
            try:
                lat, lon = data["latitude"], data["longitude"]
                if (
                    not all(
                        type(v) in (int, float) and math.isfinite(v) for v in (lat, lon)
                    )
                    or abs(lat) > 90
                    or abs(lon) > 180
                    or distance(latitude, longitude, lat, lon) > 100000
                ):
                    raise ValueError()
                returned_zone = ZoneInfo(data["timezone"])
                for i in range(16):
                    stamp = datetime.combine(
                        today + timedelta(days=i), datetime.min.time()
                    )
                    if (
                        stamp.replace(tzinfo=returned_zone).utcoffset()
                        != stamp.replace(tzinfo=ZoneInfo(zone)).utcoffset()
                    ):
                        raise ValueError()
            except (KeyError, TypeError, ValueError):
                raise WeatherFailure() from None
            result = normalize_weather(data, today)
            with self.lock:
                self.cache[key] = (now, result.model_copy(deep=True))
                self.cache.move_to_end(key)
                while len(self.cache) > 128:
                    self.cache.popitem(last=False)
            return result
        finally:
            self.slots.release()
