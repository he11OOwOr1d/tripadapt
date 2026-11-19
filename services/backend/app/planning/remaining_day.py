"""Deterministic remaining-day preview. No mutation, shortening or silent removal.

A tired traveler may explicitly ask to rest here first (`rest_minutes`) and to
skip named flexible activities (`skip_activity_ids`). Nothing is inferred: the
app never picks what to drop, and protected or completed items cannot be skipped.
"""

import math
from datetime import datetime, time, timedelta
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.planning.day_delay import seconds
from app.planning.readiness import ReadinessInput, readiness_report, scoped_day
from app.planning.validation import validate_plan


class RemainingDayInput(ReadinessInput):
    mode: Literal["WALK", "DRIVE"]
    buffer_minutes: int = Field(ge=0, le=120, default=10)
    rest_minutes: int = Field(ge=0, le=240, default=0)
    skip_activity_ids: list[UUID] = Field(default_factory=list, max_length=12)


class PreviewConflict(ValueError):
    def __init__(self, code, detail):
        self.code, self.detail = code, detail
        super().__init__(detail)


def remaining_day_preview(plan, body, now, estimate):
    """estimate(origin place UUID, destination place UUID) returns minutes.

    Provider evidence is transient. Caller handles identity, retained sources,
    warnings and freshness. A preview is never an acceptance authorization.
    """
    report = readiness_report(plan, body, now)
    if report["status"] != "ready_for_proposal":
        raise PreviewConflict(
            "REPLAN_NOT_READY",
            "Resolve the readiness issues and confirm your current context again.",
        )
    zone = report["reported_at"].tzinfo
    if (
        datetime.combine(body.local_date, time(), tzinfo=zone).utcoffset()
        != datetime.combine(body.local_date, time(23, 59), tzinfo=zone).utcoffset()
    ):
        raise PreviewConflict(
            "REPLAN_DST_DAY",
            "This day changes its UTC offset. Review the timing manually; a wall-clock preview cannot safely distinguish repeated or missing times yet.",
        )
    _, day = scoped_day(plan, body.stop_id, body.local_day_offset)
    upcoming = [a for a in day if not a.resolved]
    skip = set(body.skip_activity_ids)
    if len(skip) != len(body.skip_activity_ids):
        raise PreviewConflict(
            "REPLAN_SKIP_INVALID", "Each activity can be skipped once."
        )
    by_id = {a.logical_id: a for a in upcoming}
    for activity_id in skip:
        item = by_id.get(activity_id)
        if item is None:
            raise PreviewConflict(
                "REPLAN_SKIP_INVALID",
                "Only remaining activities on this day can be skipped. Nothing changed.",
            )
        if item.fixed or item.booked:
            raise PreviewConflict(
                "REPLAN_SKIP_PROTECTED",
                f"{item.user_label} is fixed or booked, so it cannot be skipped here. Change it explicitly in the planner.",
            )
    skipped = [a for a in upcoming if a.logical_id in skip]
    upcoming = [a for a in upcoming if a.logical_id not in skip]
    if len(upcoming) > 6:
        raise PreviewConflict(
            "REPLAN_PREVIEW_LIMIT",
            "This preview checks up to six remaining visits. Your trip length is unchanged; adjust a smaller day manually for now.",
        )
    if any(a.place_id is None for a in upcoming):
        raise PreviewConflict(
            "REPLAN_MAP_REQUIRED",
            "Link a map location for every remaining activity, including commitments, before checking connecting journeys.",
        )
    candidate = plan.model_copy(deep=True)
    candidate.activities = [a for a in candidate.activities if a.logical_id not in skip]
    targets = {a.logical_id: a for a in candidate.activities}
    # Round forward from the actual clock, never back to the reported minute.
    local_now = now.astimezone(report["reported_at"].tzinfo)
    cursor = (
        max(
            seconds(local_now.timetz().replace(tzinfo=None)),
            seconds(time.fromisoformat(body.local_time)),
        )
        + body.rest_minutes * 60
    )
    origin = body.current_location_place_id
    changes, journeys = [], []
    for item in upcoming:
        minutes = estimate(origin, item.place_id)
        if type(minutes) is not int or minutes < 0:
            raise PreviewConflict(
                "REPLAN_ROUTE_UNAVAILABLE",
                "A connecting journey returned unusable timing. Nothing changed.",
            )
        earliest = (
            math.ceil((cursor + minutes * 60 + body.buffer_minutes * 60) / 60) * 60
        )
        original = seconds(item.local_start_time)
        proposed = max(original, earliest)
        if (item.fixed or item.booked) and proposed > original:
            raise PreviewConflict(
                "REPLAN_COMMITMENT_CONFLICT",
                f"The journey would miss {item.user_label} at {item.local_start_time:%H:%M}. The commitment stays fixed; shorten or remove flexible activities explicitly in the planner.",
            )
        if proposed + item.duration_minutes * 60 > 86400:
            raise PreviewConflict(
                "REPLAN_MIDNIGHT",
                f"{item.user_label} would finish after midnight. Choose a smaller scope manually; nothing changed.",
            )
        after = (datetime(2000, 1, 1) + timedelta(seconds=proposed)).time()
        targets[item.logical_id].local_start_time = after
        changes.append(
            dict(
                activity_id=str(item.logical_id),
                label=item.user_label,
                before=item.local_start_time.strftime("%H:%M"),
                after=after.strftime("%H:%M"),
                duration_minutes=item.duration_minutes,
                protected=item.fixed or item.booked,
            )
        )
        journeys.append(
            dict(
                origin_place_id=str(origin),
                destination_place_id=str(item.place_id),
                destination_activity_id=str(item.logical_id),
                travel_minutes=minutes,
                buffer_minutes=body.buffer_minutes,
            )
        )
        cursor = proposed + item.duration_minutes * 60
        origin = item.place_id
    if any(issue["blocking"] for issue in validate_plan(candidate)["issues"]):
        raise PreviewConflict(
            "REPLAN_CANDIDATE_CONFLICT",
            "The proposed timing conflicts with the plan. Nothing changed.",
        )
    return dict(
        changes=changes,
        journeys=journeys,
        rest_minutes=body.rest_minutes,
        skipped=[
            dict(
                activity_id=str(a.logical_id),
                label=a.user_label,
                start=a.local_start_time.strftime("%H:%M"),
                duration_minutes=a.duration_minutes,
            )
            for a in skipped
        ],
        unchanged=not skipped and all(c["before"] == c["after"] for c in changes),
    )
