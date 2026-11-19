"""Traveler-reported remaining-day context. No edits, GPS or provider requests."""

from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import Field

from app.planning.day_delay import seconds
from app.planning.validation import validate_plan
from app.trips.schemas import StrictModel


class ReadinessInput(StrictModel):
    basis: Literal["accepted", "draft"]
    base_version_id: UUID
    scope: Literal["remaining_day"]
    stop_id: UUID
    local_day_offset: int = Field(ge=0)
    local_date: date
    local_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    utc_offset_minutes: int = Field(ge=-840, le=840)
    current_location_place_id: UUID
    confirmed: Literal[True]


class ReadinessActivity(StrictModel):
    activity_id: UUID
    label: str
    start: str
    duration_minutes: int
    fixed: bool
    booked: bool
    completed: bool
    skipped: bool = False
    place_id: UUID | None


def activity_view(item):
    return ReadinessActivity(
        activity_id=item.logical_id,
        label=item.user_label,
        start=item.local_start_time.strftime("%H:%M"),
        duration_minutes=item.duration_minutes,
        fixed=item.fixed,
        booked=item.booked,
        completed=item.completed,
        skipped=item.skipped,
        place_id=item.place_id,
    )


def scoped_day(plan, stop_id, offset):
    stop = next((s for s in plan.stops if s.client_id == str(stop_id)), None)
    if (
        stop is None
        or stop.desired_nights is None
        or not 0 <= offset <= stop.desired_nights
    ):
        raise ValueError("REPLAN_SCOPE_UNAVAILABLE")
    day = sorted(
        (
            a
            for a in plan.activities
            if a.stop_logical_id == stop_id and a.local_day_offset == offset
        ),
        key=lambda a: (a.local_start_time, str(a.logical_id)),
    )
    return stop, day


def reported_instant(zone, local_date, local_time, offset_minutes):
    naive = datetime.combine(local_date, time.fromisoformat(local_time))
    for fold in (0, 1):
        local = naive.replace(tzinfo=ZoneInfo(zone), fold=fold)
        utc = local.astimezone(timezone.utc)
        if (
            local.utcoffset() == timedelta(minutes=offset_minutes)
            and utc.astimezone(ZoneInfo(zone)).replace(tzinfo=None) == naive
        ):
            return utc, local
    raise ValueError("REPLAN_TIME_OFFSET_MISMATCH")


def readiness_report(plan, body, now):
    from app.planning.live_acceptance import planned_visit_date

    stop, day = scoped_day(plan, body.stop_id, body.local_day_offset)
    local_now = now.astimezone(ZoneInfo(stop.timezone))
    if body.local_date != local_now.date():
        raise ValueError("REPLAN_DATE_NOT_TODAY")
    scheduled = planned_visit_date(
        plan,
        {
            "scope": {
                "stop_logical_id": str(body.stop_id),
                "local_day_offset": body.local_day_offset,
            }
        },
    )
    if scheduled and scheduled != body.local_date:
        raise ValueError("REPLAN_SCHEDULE_DATE_MISMATCH")
    instant, local = reported_instant(
        stop.timezone, body.local_date, body.local_time, body.utc_offset_minutes
    )
    if abs(now - instant) > timedelta(minutes=5):
        raise ValueError("REPLAN_TIME_STALE")
    buckets = {
        key: []
        for key in (
            "completed",
            "skipped",
            "past_unresolved",
            "in_progress",
            "protected",
            "flexible",
        )
    }
    clock = seconds(local.timetz().replace(tzinfo=None))
    for item in day:
        start = seconds(item.local_start_time)
        if item.completed:
            key = "completed"
        elif item.skipped:
            key = "skipped"
        elif start + item.duration_minutes * 60 <= clock:
            key = "past_unresolved"
        elif start < clock:
            key = "in_progress"
        elif item.fixed or item.booked:
            key = "protected"
        else:
            key = "flexible"
        buckets[key].append(activity_view(item))
    issues = []
    if buckets["past_unresolved"]:
        issues.append(
            dict(
                code="PAST_UNRESOLVED",
                detail="Earlier activities are not marked completed. Resolve their status in the plan before requesting a revision.",
                activity_ids=[a.activity_id for a in buckets["past_unresolved"]],
            )
        )
    if buckets["in_progress"]:
        issues.append(
            dict(
                code="IN_PROGRESS_UNCONFIRMED",
                detail="An activity overlaps your reported time. Confirm its status in the plan; it will not be shortened or moved automatically.",
                activity_ids=[a.activity_id for a in buckets["in_progress"]],
            )
        )
    if not buckets["flexible"]:
        issues.append(
            dict(
                code="NO_FLEXIBLE_REMAINDER",
                detail="No future flexible activities remain in this scope. Completed items and commitments stay unchanged.",
                activity_ids=[],
            )
        )
    blockers = [i for i in validate_plan(plan)["issues"] if i["blocking"]]
    if blockers:
        issues.append(
            dict(
                code="BASE_PLAN_CONFLICT",
                detail="The selected plan has unresolved allocation or schedule conflicts. Resolve them before preparing a revision.",
                activity_ids=[],
            )
        )
    return dict(
        status="needs_attention" if issues else "ready_for_proposal",
        reported_at=local,
        checked_at=now,
        expires_at=now + timedelta(minutes=5),
        issues=issues,
        **buckets,
    )
