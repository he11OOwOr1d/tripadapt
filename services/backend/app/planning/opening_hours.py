"""Deterministic whole-visit comparison against Google's current dated periods."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def check_hours(details, visit_date, start, minutes, timezone, now):
    zone = ZoneInfo(timezone)
    today = now.astimezone(zone).date()
    if details.get("businessStatus") in ("CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"):
        return (
            "reported_closed",
            "Google Maps currently reports this place as closed. Confirm with the venue before planning a visit.",
        )
    if visit_date is None:
        return (
            "date_needed",
            "Choose a visit date to compare your time with reported hours.",
        )
    if not today <= visit_date <= today + timedelta(days=6):
        return (
            "outside_coverage",
            "This date is outside Google's current seven-day hours window. Regular hours are indicative; check again nearer your visit.",
        )
    hours = details.get("currentOpeningHours")
    if (
        not isinstance(hours, dict)
        or not isinstance(hours.get("periods"), list)
        or not hours["periods"]
    ):
        return (
            "hours_unknown",
            "Current dated opening hours are unavailable. Confirm directly with the venue.",
        )
    begin = datetime.combine(visit_date, start)
    end = begin + timedelta(minutes=minutes)
    if end.date() > today + timedelta(days=6):
        return (
            "outside_coverage",
            "The visit extends beyond the current hours window. Check again nearer your visit.",
        )

    def unique_local(value):
        aware = value.replace(tzinfo=zone)
        return (
            aware.utcoffset() == value.replace(tzinfo=zone, fold=1).utcoffset()
            and aware.astimezone(ZoneInfo("UTC")).astimezone(zone).replace(tzinfo=None)
            == value
        )

    if (
        not unique_local(begin)
        or not unique_local(end)
        or begin.replace(tzinfo=zone).utcoffset()
        != end.replace(tzinfo=zone).utcoffset()
    ):
        return (
            "hours_unknown",
            "This visit crosses an ambiguous clock change. Confirm local times before comparing opening hours.",
        )
    intervals = []
    for period in hours["periods"]:
        try:
            opened = period["open"]
            closed = period.get("close")
            if closed is None:
                if (
                    opened.get("day") == 0
                    and opened.get("hour") == 0
                    and opened.get("minute", 0) == 0
                    and "date" not in opened
                ):
                    return (
                        "fits_reported_hours",
                        "Your full visit fits the reported 24-hour schedule. Hours can change; confirm with the venue.",
                    )
                raise ValueError()

            def point(value):
                stamp = value["date"]
                return datetime.combine(
                    date(stamp["year"], stamp["month"], stamp["day"]),
                    time(value["hour"], value.get("minute", 0)),
                )

            left, right = point(opened), point(closed)
            if right <= left:
                raise ValueError()
            intervals.append((left, right))
        except (KeyError, TypeError, ValueError):
            return (
                "hours_unknown",
                "The reported hours could not be compared safely. Confirm directly with the venue.",
            )
    # Merge adjacent intervals before checking the entire proposed visit.
    merged = []
    for left, right in sorted(intervals):
        if merged and left <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(right, merged[-1][1]))
        else:
            merged.append((left, right))
    if any(left <= begin and end <= right for left, right in merged):
        return (
            "fits_reported_hours",
            "Your full visit fits the reported opening hours. Hours can change; confirm with the venue.",
        )
    if any(left < end and begin < right for left, right in merged):
        return (
            "outside_reported_hours",
            "Part of this visit falls outside reported opening hours. Change the time or duration.",
        )
    return (
        "outside_reported_hours",
        "This visit is outside reported opening hours. Choose another time or confirm directly with the venue.",
    )
