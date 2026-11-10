"""Bounded Open-Meteo/GeoNames lookup for explicit prototype searches."""

import json
import ssl
import threading
import time
from collections import OrderedDict, deque
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import certifi
from pydantic import Field, ValidationError, field_validator

from app.trips.schemas import StrictModel


class Place(StrictModel):
    id: int = Field(gt=0)
    label: str = Field(min_length=1, max_length=300)
    name: str = Field(min_length=1, max_length=300)
    region: str = Field(max_length=300)
    country: str = Field(max_length=300)
    timezone: str = Field(min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)

    @field_validator("timezone")
    @classmethod
    def iana_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError):
            raise ValueError("Invalid timezone") from None
        return value


class PlaceSearch(StrictModel):
    results: list[Place]
    source: str = "Open-Meteo / GeoNames"
    retrieved_at: datetime
    cached: bool = False


class GeocodingFailure(Exception):
    def __init__(self, code, status=503):
        self.code, self.status = code, status


def fetch_json(query):
    # Fixed host, bounded body/time, verified TLS; query text cannot become a URL.
    url = "https://geocoding-api.open-meteo.com/v1/search?" + urlencode(
        {"name": query, "count": 8, "language": "en", "format": "json"}
    )
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Elsewhere-local-prototype/0.1",
        },
    )
    try:
        with urlopen(
            request,
            timeout=5,
            context=ssl.create_default_context(cafile=certifi.where()),
        ) as response:
            body = response.read(65537)
        if len(body) > 65536:
            raise ValueError()
        data = json.loads(body)
        if not isinstance(data, dict) or data.get("error"):
            raise ValueError()
        return data
    except HTTPError as error:
        raise GeocodingFailure(
            "PLACE_PROVIDER_RATE_LIMITED"
            if error.code == 429
            else "PLACE_PROVIDER_UNAVAILABLE",
            429 if error.code == 429 else 503,
        ) from None
    except (URLError, TimeoutError, ValueError, OSError):
        raise GeocodingFailure("PLACE_PROVIDER_UNAVAILABLE") from None


class Geocoder:
    def __init__(self, transport=None, clock=time.monotonic):
        self.transport = transport or fetch_json
        self.clock = clock
        self.cache = OrderedDict()
        self.calls = deque()
        self.lock = threading.Lock()
        self.slots = threading.BoundedSemaphore(4)

    def search(self, query):
        key = query.casefold()
        stamp = self.clock()
        with self.lock:
            cached = self.cache.get(key)
            if cached and stamp - cached[0] < 86400:
                self.cache.move_to_end(key)
                result = cached[1].model_copy(deep=True)
                result.cached = True
                return result
            while self.calls and stamp - self.calls[0] >= 60:
                self.calls.popleft()
            if len(self.calls) >= 30:
                raise GeocodingFailure("PLACE_SEARCH_RATE_LIMITED", 429)
            self.calls.append(stamp)
        if not self.slots.acquire(blocking=False):
            raise GeocodingFailure("PLACE_SEARCH_BUSY", 429)
        try:
            data = self.transport(query)
            raw = data.get("results", [])
            if not isinstance(raw, list):
                raise GeocodingFailure("PLACE_PROVIDER_UNAVAILABLE")
            choices, seen = [], set()
            for item in raw[:8]:
                try:
                    name, region, country = (
                        item["name"],
                        item.get("admin1", ""),
                        item.get("country", ""),
                    )
                    label = ", ".join(
                        dict.fromkeys(s for s in (name, region, country) if s)
                    )
                    place = Place(
                        id=item["id"],
                        label=label,
                        name=name,
                        region=region,
                        country=country,
                        timezone=item["timezone"],
                        latitude=item["latitude"],
                        longitude=item["longitude"],
                    )
                    if place.id not in seen:
                        choices.append(place)
                        seen.add(place.id)
                except (KeyError, TypeError, ValueError, ValidationError):
                    continue
            if raw and not choices:
                raise GeocodingFailure("PLACE_PROVIDER_UNAVAILABLE")
            result = PlaceSearch(
                results=choices, retrieved_at=datetime.now(timezone.utc)
            )
            with self.lock:
                self.cache[key] = (stamp, result.model_copy(deep=True))
                self.cache.move_to_end(key)
                while len(self.cache) > 200:
                    self.cache.popitem(last=False)
            return result
        finally:
            self.slots.release()
