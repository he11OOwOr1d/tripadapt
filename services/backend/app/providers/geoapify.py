"""Hosted OSM-backed discovery. Credentials and upstream errors stay server-side."""

import json
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi

from app.config import settings

CATEGORIES = {
    "museum": "entertainment.museum",
    "gallery": "entertainment.culture.gallery",
    "attraction": "tourism.attraction",
    "park": "leisure.park",
    "viewpoint": "tourism.attraction.viewpoint",
}


def fetch_geoapify(latitude, longitude, category):
    from app.providers.activities import DiscoveryFailure

    key = settings.geoapify_api_key.get_secret_value()
    if not key:
        raise DiscoveryFailure("ACTIVITY_PROVIDER_NOT_CONFIGURED")
    if category not in CATEGORIES:
        raise DiscoveryFailure("ACTIVITY_QUERY_INVALID", 422)
    request = Request(
        "https://api.geoapify.com/v2/places?"
        + urlencode(
            {
                "categories": CATEGORIES[category],
                "filter": f"circle:{longitude:.6f},{latitude:.6f},5000",
                "bias": f"proximity:{longitude:.6f},{latitude:.6f}",
                "limit": 12,
                "lang": "en",
                "apiKey": key,
            }
        ),
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
        if not isinstance(data, dict) or not isinstance(data.get("features"), list):
            raise ValueError()
        elements = []
        for feature in data["features"][:12]:
            try:
                properties = feature["properties"]
                if not any(
                    c == CATEGORIES[category]
                    or c.startswith(CATEGORIES[category] + ".")
                    for c in properties["categories"]
                ):
                    continue
                elements.append(
                    {
                        "external_id": f"geoapify/{properties['place_id']}",
                        "tags": {"name": properties["name"], "leisure": "park"}
                        if category == "park"
                        else {"name": properties["name"], "tourism": category},
                        "lat": properties["lat"],
                        "lon": properties["lon"],
                    }
                )
            except (KeyError, TypeError, AttributeError):
                continue
        if data["features"] and not elements:
            raise ValueError()
        return {"elements": elements, "source": "Geoapify / OpenStreetMap contributors"}
    except HTTPError as error:
        code = (
            "ACTIVITY_PROVIDER_RATE_LIMITED"
            if error.code == 429
            else "ACTIVITY_PROVIDER_AUTH_FAILED"
            if error.code in (401, 403)
            else "ACTIVITY_PROVIDER_UNAVAILABLE"
        )
        raise DiscoveryFailure(code, 429 if error.code == 429 else 503) from None
    except (URLError, TimeoutError, ValueError, OSError):
        raise DiscoveryFailure("ACTIVITY_PROVIDER_UNAVAILABLE") from None
