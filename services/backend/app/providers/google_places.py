"""On-demand Google Places data. Never cache payloads or expose credentials."""

import json
import ssl
import threading
import time
from collections import defaultdict, deque
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

import certifi
from pydantic import Field

from app.config import settings
from app.trips.schemas import StrictModel

GOOGLE_ID = r"^[A-Za-z0-9_-]{1,200}$"


class GoogleFailure(Exception):
    def __init__(self, code, status=503):
        self.code, self.status = code, status


class GoogleMatch(StrictModel):
    id: str = Field(pattern=GOOGLE_ID)
    name: str = Field(min_length=1, max_length=500)
    address: str = Field(max_length=1000)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class GooglePlaces:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.Lock()
        self.calls = deque()
        self.owners = defaultdict(deque)
        self.slots = threading.BoundedSemaphore(2)

    def request(self, owner, path, fields, payload=None, *, routes=False):
        key = (
            settings.routes_api_key.get_secret_value() if routes else ""
        ) or settings.google_maps_api_key.get_secret_value()
        if not key:
            raise GoogleFailure("GOOGLE_PLACES_NOT_CONFIGURED")
        now = self.clock()
        with self.lock:
            while self.calls and now - self.calls[0] >= 86400:
                self.calls.popleft()
            # Prune owner buckets with no daily usage, bounding process memory.
            for ident in list(self.owners):
                while self.owners[ident] and now - self.owners[ident][0] >= 86400:
                    self.owners[ident].popleft()
                if not self.owners[ident]:
                    del self.owners[ident]
            personal = self.owners.get(owner, deque())
            if (
                len(self.calls) >= 100
                or sum(now - t < 60 for t in self.calls) >= 6
                or len(personal) >= 30
            ):
                raise GoogleFailure("GOOGLE_PLACES_RATE_LIMITED", 429)
            if not self.slots.acquire(blocking=False):
                raise GoogleFailure("GOOGLE_PLACES_BUSY", 429)
            self.calls.append(now)
            self.owners[owner].append(now)
        request = Request(
            (
                "https://routes.googleapis.com/directions/v2:computeRoutes"
                if routes
                else "https://places.googleapis.com/v1/" + path
            ),
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": fields,
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
            result = json.loads(body)
            if not isinstance(result, dict) or result.get("error"):
                raise ValueError()
            return result
        except HTTPError as error:
            code = (
                "GOOGLE_PLACES_RATE_LIMITED"
                if error.code == 429
                else "GOOGLE_PLACES_ACCESS_DENIED"
                if error.code in (401, 403)
                else "GOOGLE_PLACE_NOT_FOUND"
                if error.code == 404
                else "GOOGLE_PLACES_UNAVAILABLE"
            )
            raise GoogleFailure(
                code, 429 if error.code == 429 else 404 if error.code == 404 else 503
            ) from None
        except (URLError, TimeoutError, ValueError, OSError):
            raise GoogleFailure("GOOGLE_PLACES_UNAVAILABLE") from None
        finally:
            self.slots.release()

    def matches(self, owner, name, latitude, longitude):
        data = self.request(
            owner,
            "places:searchText",
            "places.id,places.displayName,places.formattedAddress,places.location",
            {
                "textQuery": name,
                "pageSize": 3,
                "languageCode": "en",
                "locationBias": {
                    "circle": {
                        "center": {"latitude": latitude, "longitude": longitude},
                        "radius": 1000,
                    }
                },
            },
        )
        raw = data.get("places", [])
        if not isinstance(raw, list):
            raise GoogleFailure("GOOGLE_PLACES_UNAVAILABLE")
        matches = []
        for place in raw[:3]:
            try:
                matches.append(
                    GoogleMatch(
                        id=place["id"],
                        name=place["displayName"]["text"],
                        address=place.get("formattedAddress", ""),
                        latitude=place["location"]["latitude"],
                        longitude=place["location"]["longitude"],
                    )
                )
            except (KeyError, TypeError, ValueError):
                continue
        if raw and not matches:
            raise GoogleFailure("GOOGLE_PLACES_UNAVAILABLE")
        return matches

    def details(self, owner, ident):
        return self.request(
            owner,
            "places/" + quote(ident, safe=""),
            "id,displayName,formattedAddress,location,businessStatus,currentOpeningHours,regularOpeningHours,priceLevel,priceRange,attributions",
        )
