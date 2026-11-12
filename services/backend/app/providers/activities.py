"""Explicit, bounded OSM discovery for local evaluation, not live availability."""

import json
import math
import ssl
import threading
import time
from collections import OrderedDict, deque
from datetime import datetime, timezone
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi
from pydantic import Field, ValidationError

from app.config import settings
from app.trips.schemas import StrictModel

Category = Literal["museum", "gallery", "attraction", "park", "viewpoint"]
FILTERS = {
    "museum": "[tourism=museum]",
    "gallery": "[tourism=gallery]",
    "attraction": "[tourism=attraction]",
    "park": "[leisure=park]",
    "viewpoint": "[tourism=viewpoint]",
}


class ActivityPlace(StrictModel):
    external_id: str = Field(
        max_length=500,
        pattern=r"^((node|way|relation)/[1-9][0-9]*|geoapify/[A-Za-z0-9_-]{1,400})$",
    )
    name: str = Field(min_length=1, max_length=300)
    category: Category
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class ActivitySearch(StrictModel):
    results: list[ActivityPlace]
    retrieved_at: datetime
    cached: bool = False
    source: str = "OpenStreetMap contributors via Overpass"
    coverage: str = "partial"
    radius_meters: int = 5000


class DiscoveryFailure(Exception):
    def __init__(self, code, status=503):
        self.code, self.status = code, status


def fetch_places(latitude, longitude, category):
    if settings.activity_places_provider == "geoapify" or (
        settings.activity_places_provider == "auto"
        and settings.geoapify_api_key.get_secret_value()
    ):
        from app.providers.geoapify import fetch_geoapify

        return fetch_geoapify(latitude, longitude, category)
    # No traveler text or arbitrary URLs enter the query. Category is allowlisted.
    query = f"[out:json][timeout:6][maxsize:8388608];nwr(around:5000,{latitude:.6f},{longitude:.6f}){FILTERS[category]}[name];out center 40;"
    request = Request(
        "https://overpass-api.de/api/interpreter",
        data=urlencode({"data": query}).encode(),
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
            body = response.read(131073)
        if len(body) > 131072:
            raise ValueError()
        data = json.loads(body)
        if (
            not isinstance(data, dict)
            or data.get("remark")
            or not isinstance(data.get("elements"), list)
        ):
            raise ValueError()
        return data
    except HTTPError as error:
        raise DiscoveryFailure(
            "ACTIVITY_PROVIDER_RATE_LIMITED"
            if error.code == 429
            else "ACTIVITY_PROVIDER_UNAVAILABLE",
            429 if error.code == 429 else 503,
        ) from None
    except (URLError, TimeoutError, ValueError, OSError):
        raise DiscoveryFailure("ACTIVITY_PROVIDER_UNAVAILABLE") from None


def distance(a, b, c, d):
    lat, target = math.radians(a), math.radians(c)
    h = (
        math.sin((target - lat) / 2) ** 2
        + math.cos(lat) * math.cos(target) * math.sin(math.radians(d - b) / 2) ** 2
    )
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


class ActivityDiscovery:
    def __init__(self, transport=None, clock=time.monotonic):
        self.transport = transport or fetch_places
        self.clock = clock
        self.lock = threading.Lock()
        self.slots = threading.BoundedSemaphore(2)
        self.calls = deque()
        self.cache = OrderedDict()

    def search(self, latitude, longitude, category):
        if (
            category not in FILTERS
            or not all(math.isfinite(v) for v in (latitude, longitude))
            or abs(latitude) > 90
            or abs(longitude) > 180
        ):
            raise DiscoveryFailure("ACTIVITY_QUERY_INVALID", 422)
        key = (latitude, longitude, category)
        now = self.clock()
        with self.lock:
            cached = self.cache.get(key)
            if cached and now - cached[0] < 86400:
                self.cache.move_to_end(key)
                return cached[1].model_copy(deep=True, update={"cached": True})
            while self.calls and now - self.calls[0] >= 86400:
                self.calls.popleft()
            if len(self.calls) >= 300 or sum(now - t < 60 for t in self.calls) >= 6:
                raise DiscoveryFailure("ACTIVITY_SEARCH_RATE_LIMITED", 429)
            if not self.slots.acquire(blocking=False):
                raise DiscoveryFailure("ACTIVITY_SEARCH_BUSY", 429)
            self.calls.append(now)
        try:
            data = self.transport(latitude, longitude, category)
            if (
                not isinstance(data, dict)
                or data.get("remark")
                or not isinstance(data.get("elements"), list)
            ):
                raise DiscoveryFailure("ACTIVITY_PROVIDER_UNAVAILABLE")
            places = {}
            for raw in data["elements"][:40]:
                try:
                    tags = raw["tags"]
                    if tags.get("tourism") != category and not (
                        category == "park" and tags.get("leisure") == "park"
                    ):
                        continue
                    center = raw.get("center", raw)
                    place = ActivityPlace(
                        external_id=raw["external_id"]
                        if "external_id" in raw
                        else f"{raw['type']}/{raw['id']}",
                        name=tags["name"].strip(),
                        category=category,
                        latitude=center["lat"],
                        longitude=center["lon"],
                    )
                    if any(ord(c) < 32 for c in place.name):
                        continue
                    if (
                        distance(latitude, longitude, place.latitude, place.longitude)
                        <= 5000
                    ):
                        places[place.external_id] = place
                except (KeyError, TypeError, AttributeError, ValidationError):
                    continue
            if data["elements"] and not places:
                raise DiscoveryFailure("ACTIVITY_NO_USABLE_RESULTS")
            result = ActivitySearch(
                results=sorted(
                    places.values(),
                    key=lambda p: (
                        distance(latitude, longitude, p.latitude, p.longitude),
                        p.external_id,
                    ),
                )[:12],
                source="Geoapify / OpenStreetMap contributors"
                if data.get("source") == "Geoapify / OpenStreetMap contributors"
                else "OpenStreetMap contributors via Overpass",
                retrieved_at=datetime.now(timezone.utc),
            )
            with self.lock:
                self.cache[key] = (now, result.model_copy(deep=True))
                self.cache.move_to_end(key)
                while len(self.cache) > 128:
                    self.cache.popitem(last=False)
            return result
        finally:
            self.slots.release()
