"""Deterministic whole-visit comparison against OpenStreetMap's regular hours.

OpenStreetMap lists recurring rules, for example ``Tu-Su 10:00-17:00; Dec 25
off``. They carry no live closures, so every answer is labeled unverified and
anything this module cannot interpret safely is reported as unknown.
"""

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import opening_hours as osm

CAVEAT = (
    " These are regular hours from OpenStreetMap contributors and are not "
    "verified. Holidays and special closures may be missing; confirm with the venue."
)
SUNLIGHT = re.compile(r"\b(sunrise|sunset|dawn|dusk)\b", re.IGNORECASE)
HOLIDAY = re.compile(r"\bPH\b")
SCHOOL_HOLIDAY = re.compile(r"\bSH\b")
UNREADABLE = (
    "hours_unknown",
    "The listed hours use a format this app cannot interpret safely. Confirm directly with the venue.",
)


def unique_local(value, zone):
    """A wall-clock time that exists exactly once; clock changes are never guessed."""
    aware = value.replace(tzinfo=zone)
    return (
        aware.utcoffset() == value.replace(tzinfo=zone, fold=1).utcoffset()
        and aware.astimezone(ZoneInfo("UTC")).astimezone(zone).replace(tzinfo=None)
        == value
    )


def check_hours(rules, visit_date, start, minutes, timezone, now, country, coords):
    """Return (status, explanation) for one whole visit at a venue."""
    zone = ZoneInfo(timezone)
    if not rules or not rules.strip():
        return (
            "hours_unknown",
            "No opening hours are listed for this place. Confirm directly with the venue.",
        )
    if visit_date is None:
        return (
            "date_needed",
            "Choose a visit date to compare your time with reported hours.",
        )
    if visit_date < now.astimezone(zone).date():
        return (
            "outside_coverage",
            "That date has already passed. Choose today or a later date.",
        )
    if SCHOOL_HOLIDAY.search(rules):
        return (
            "hours_unknown",
            "These hours depend on school holidays, which this app cannot check. Confirm directly with the venue.",
        )
    begin = datetime.combine(visit_date, start)
    end = begin + timedelta(minutes=minutes)
    if (
        not unique_local(begin, zone)
        or not unique_local(end, zone)
        or begin.replace(tzinfo=zone).utcoffset()
        != end.replace(tzinfo=zone).utcoffset()
    ):
        return (
            "hours_unknown",
            "This visit crosses an ambiguous clock change. Confirm local times before comparing opening hours.",
        )
    options = {}
    if HOLIDAY.search(rules):
        # Without a country, public-holiday rules would be silently ignored.
        if not country:
            return (
                "hours_unknown",
                "These hours depend on public holidays, but the country is unknown. Confirm directly with the venue.",
            )
        options["country"] = country
    if SUNLIGHT.search(rules):
        options["coords"] = coords
    try:
        spans = list(osm.OpeningHours(rules, **options).intervals(begin, end))
    except (
        osm.ParserError,
        osm.UnknownCountryError,
        osm.InvalidCoordinatesError,
        SyntaxError,
        ValueError,
        OverflowError,
    ):
        return UNREADABLE
    if not spans or any(
        state == osm.State.UNKNOWN or comment for _, _, state, comment in spans
    ):
        return UNREADABLE
    if all(state == osm.State.OPEN for _, _, state, _ in spans):
        return (
            "fits_reported_hours",
            "Your full visit fits the regular opening hours." + CAVEAT,
        )
    if any(state == osm.State.OPEN for _, _, state, _ in spans):
        return (
            "outside_reported_hours",
            "Part of this visit falls outside the regular opening hours. Change the time or duration."
            + CAVEAT,
        )
    return (
        "outside_reported_hours",
        "This visit is outside the regular opening hours. Choose another time or confirm directly with the venue."
        + CAVEAT,
    )
