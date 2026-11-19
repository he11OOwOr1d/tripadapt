"""Frozen timing changes only; live route evidence is never persisted."""

from datetime import time

from app.planning.validation import same_plan

REMAINING_ISSUE = dict(
    id="REMAINING_DAY:context",
    code="REMAINING_DAY",
    activity_id=None,
    blocking=False,
    acknowledgeable=True,
    detail="I am still at the reported starting location. This timing proposal changes only flexible start times. Routes will be checked again. Venue hours remain provisional unless I enable the reported-hours check. Weather, prices and reservations remain unverified. Nothing is booked.",
)


def fatigue_issue(metadata):
    """Extra acknowledgement when the traveler chose to rest or skip items."""
    skipped = metadata.get("skipped") or []
    rest = metadata.get("request", {}).get("rest_minutes", 0)
    if not skipped and not rest:
        return None
    parts = []
    if rest:
        parts.append(f"I will rest for {rest} minutes before moving on.")
    if skipped:
        names = ", ".join(f"{s['label']} ({s['start']})" for s in skipped)
        parts.append(
            f"I chose to skip {names}. Skipping does not cancel or refund anything; "
            "paid costs linked to them stay recorded and their estimates are removed."
        )
    return dict(
        id="REMAINING_DAY_FATIGUE:context",
        code="REMAINING_DAY_FATIGUE",
        activity_id=None,
        blocking=False,
        acknowledgeable=True,
        detail=" ".join(parts),
    )


def apply_remaining(base, changes, skipped=()):
    candidate = base.model_copy(deep=True)
    if skipped:
        present = {str(a.logical_id): a for a in candidate.activities}
        for entry in skipped:
            item = present.get(entry["activity_id"])
            if (
                item is None
                or item.resolved
                or item.fixed
                or item.booked
                or item.user_label != entry["label"]
                or item.local_start_time.strftime("%H:%M") != entry["start"]
            ):
                raise ValueError("PLAN_CONFLICT")
        gone = {entry["activity_id"] for entry in skipped}
        candidate.activities = [
            a for a in candidate.activities if str(a.logical_id) not in gone
        ]
    targets = {str(a.logical_id): a for a in candidate.activities}
    for change in changes:
        item = targets[change["activity_id"]]
        if (
            item.resolved
            or item.user_label != change["label"]
            or item.duration_minutes != change["duration_minutes"]
            or item.local_start_time.strftime("%H:%M") != change["before"]
        ):
            raise ValueError("PLAN_CONFLICT")
        after = time.fromisoformat(change["after"])
        if after < item.local_start_time or (
            (item.fixed or item.booked) and after != item.local_start_time
        ):
            raise ValueError("PLAN_CONFLICT")
        item.local_start_time = after
    # Re-validate so linked costs follow the removal rule exactly as the stored
    # candidate does; a bare model copy would keep links to skipped activities.
    return type(candidate).model_validate(candidate.model_dump())


def validate_remaining(base, candidate, metadata):
    from app.planning.readiness import scoped_day
    from app.planning.remaining_day import RemainingDayInput

    body = RemainingDayInput.model_validate(metadata["request"])
    _, day = scoped_day(base, body.stop_id, body.local_day_offset)
    skipped = metadata.get("skipped") or []
    gone = {s["activity_id"] for s in skipped}
    if gone != {str(i) for i in body.skip_activity_ids}:
        raise ValueError("PLAN_CONFLICT")
    ids = [
        str(a.logical_id)
        for a in day
        if not a.resolved and str(a.logical_id) not in gone
    ]
    if ids != [c["activity_id"] for c in metadata["changes"]] or not same_plan(
        apply_remaining(base, metadata["changes"], skipped), candidate
    ):
        raise ValueError("PLAN_CONFLICT")
    return body


def frozen_routes_fit(candidate, body, preview):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from app.planning.day_delay import seconds
    from app.planning.readiness import scoped_day

    stop, day = scoped_day(candidate, body.stop_id, body.local_day_offset)
    targets = {str(a.logical_id): a for a in day}
    checked = datetime.fromisoformat(preview["checked_at"]).astimezone(
        ZoneInfo(stop.timezone)
    )
    cursor = seconds(checked.timetz().replace(tzinfo=None)) + body.rest_minutes * 60
    for leg in preview["journeys"]:
        item = targets[leg["destination_activity_id"]]
        if cursor + (leg["travel_minutes"] + leg["buffer_minutes"]) * 60 > seconds(
            item.local_start_time
        ):
            raise ValueError("REPLAN_REVIEW_EXPIRED")
        cursor = seconds(item.local_start_time) + item.duration_minutes * 60


def recheck_remaining_hours(db, user, request, candidate, metadata, checks):
    import re
    from datetime import date

    from fastapi import HTTPException

    from app.planning.live_acceptance import recheck_visits_and_journeys
    from app.providers.google_places import GOOGLE_ID

    command = metadata["request"]
    ids = {change["activity_id"] for change in metadata["changes"]}
    visits = sorted(
        (a for a in candidate.activities if str(a.logical_id) in ids),
        key=lambda a: (a.local_start_time, str(a.logical_id)),
    )
    if (
        not 0 < len(visits) <= 6
        or set(checks.listings) != {a.logical_id for a in visits}
        or any(not re.fullmatch(GOOGLE_ID, value) for value in checks.listings.values())
    ):
        raise HTTPException(422, "LIVE_CHECK_LISTINGS_REQUIRED")
    if checks.visit_date != date.fromisoformat(command["local_date"]):
        raise HTTPException(422, "LIVE_CHECK_DATE_MISMATCH")
    if (
        checks.mode != command["mode"]
        or checks.buffer_minutes != command["buffer_minutes"]
    ):
        raise HTTPException(422, "LIVE_CHECK_CONTEXT_MISMATCH")
    # The remaining-day guard checks every journey, including the initial leg,
    # after these venue checks. Do not substitute a delay scope or a past visit.
    recheck_visits_and_journeys(db, user, request, visits, [], checks.listings, checks)
