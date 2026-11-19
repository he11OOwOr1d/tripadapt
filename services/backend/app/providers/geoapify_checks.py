"""On-demand Geoapify route checks. Never cache payloads or expose credentials."""

import json
import math
import ssl
import threading
import time
from collections import defaultdict, deque
from typing import NamedTuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi

from app.config import settings

# Route responses include the path geometry, which is far larger than the two
# numbers we keep. Journeys never leave one destination, so 1 MiB is generous.
MAX_RESPONSE_BYTES = 1048576
MODES = {"WALK": "walk", "DRIVE": "drive"}


class CheckFailure(Exception):
    """A provider failure expressed only as an API code and HTTP status."""

    def __init__(self, code, status=503):
        super().__init__(code)
        self.code, self.status = code, status


class RouteEstimate(NamedTuple):
    minutes: int
    meters: int
    warnings: list


def parse_route(data):
    """Reject missing/malformed evidence instead of returning a zero journey."""
    try:
        properties = data["features"][0]["properties"]
        seconds, meters = properties["time"], properties["distance"]
        units = properties.get("distance_units", "meters")
        if units != "meters" or any(
            type(value) not in (int, float) or not math.isfinite(value)
            for value in (seconds, meters)
        ):
            raise ValueError()
        if not 0 <= seconds <= 604800 or not 0 <= meters <= 20000000:
            raise ValueError()
        # Geoapify has no route warning field, so a warning never blocks a plan.
        return RouteEstimate(math.ceil(seconds / 60), round(meters), [])
    except (KeyError, IndexError, TypeError, ValueError, OverflowError):
        raise CheckFailure("ROUTES_UNAVAILABLE") from None


class GeoapifyChecks:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.Lock()
        self.calls = deque()
        self.owners = defaultdict(deque)
        self.slots = threading.BoundedSemaphore(2)

    def get(self, owner, scope, url, params):
        """One bounded GET. `scope` prefixes every failure code, e.g. ROUTES."""
        key = settings.geoapify_api_key.get_secret_value()
        if not key:
            raise CheckFailure(f"{scope}_NOT_CONFIGURED")
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
                raise CheckFailure(f"{scope}_RATE_LIMITED", 429)
            if not self.slots.acquire(blocking=False):
                raise CheckFailure(f"{scope}_BUSY", 429)
            self.calls.append(now)
            self.owners[owner].append(now)
        request = Request(
            url + "?" + urlencode({**params, "apiKey": key}),
            headers={
                "Accept": "application/json",
                "User-Agent": "Elsewhere-checks/0.1",
            },
        )
        try:
            with urlopen(
                request,
                timeout=8,
                context=ssl.create_default_context(cafile=certifi.where()),
            ) as response:
                body = response.read(MAX_RESPONSE_BYTES + 1)
            if len(body) > MAX_RESPONSE_BYTES:
                raise ValueError()
            result = json.loads(body)
            if not isinstance(result, dict) or result.get("error"):
                raise ValueError()
            return result
        except HTTPError as error:
            code = (
                f"{scope}_RATE_LIMITED"
                if error.code == 429
                else f"{scope}_ACCESS_DENIED"
                if error.code in (401, 403)
                else f"{scope}_NOT_FOUND"
                if error.code == 404
                else f"{scope}_UNAVAILABLE"
            )
            raise CheckFailure(
                code, 429 if error.code == 429 else 404 if error.code == 404 else 503
            ) from None
        except (URLError, TimeoutError, ValueError, OSError):
            raise CheckFailure(f"{scope}_UNAVAILABLE") from None
        finally:
            self.slots.release()

    def route(self, owner, mode, origin, destination):
        """Estimate travel between two (latitude, longitude) pairs."""
        data = self.get(
            owner,
            "ROUTES",
            "https://api.geoapify.com/v1/routing",
            {
                "waypoints": "|".join(
                    f"{latitude:.6f},{longitude:.6f}"
                    for latitude, longitude in (origin, destination)
                ),
                "mode": MODES[mode],
            },
        )
        return parse_route(data)
