"""Conservative, user-triggered same-day delay propagation; no provider guesses."""

from datetime import date, datetime, time, timedelta
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.planning.validation import same_plan, validate_plan
from app.trips.schemas import StrictModel


class DayDelayInput(StrictModel):
    activity_id: UUID
    ready_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    at_start_location: Literal[True]


class DelayConflict(ValueError):
    def __init__(self, code, detail):
        self.code, self.detail = code, detail
        super().__init__(detail)


DELAY_ISSUE = {
    "id": "DAY_DELAY:plan",
    "code": "DAY_DELAY",
    "activity_id": None,
    "blocking": False,
    "acknowledgeable": True,
    "detail": "This user-reported delay shifts only flexible activities on the selected day. Durations and existing gaps are preserved; hours, actual travel times, costs and reservations are not rechecked. Review every change before accepting.",
}


def seconds(value):
    return (
        value.hour * 3600
        + value.minute * 60
        + value.second
        + value.microsecond / 1000000
    )


def display(value):
    return (
        value.isoformat(timespec="minutes")
        if not value.second and not value.microsecond
        else value.isoformat()
    )


def delay_day(base, command):
    first = next(
        (a for a in base.activities if a.logical_id == command.activity_id), None
    )
    if first is None:
        raise DelayConflict(
            "DELAY_START_NOT_FOUND", "Choose an activity from the current saved day."
        )
    if first.resolved:
        raise DelayConflict(
            "DELAY_COMPLETED_START",
            "Choose an activity you have not completed. Completed items stay unchanged.",
        )
    ready = seconds(time.fromisoformat(command.ready_time))
    if ready <= seconds(first.local_start_time):
        raise DelayConflict(
            "DELAY_NO_CHANGE",
            "Choose a later ready time. No delay adjustment is needed for this activity at that time.",
        )
    day = sorted(
        (
            a
            for a in base.activities
            if a.stop_logical_id == first.stop_logical_id
            and a.local_day_offset == first.local_day_offset
        ),
        key=lambda a: (a.local_start_time, str(a.logical_id)),
    )
    start = next(i for i, a in enumerate(day) if a.logical_id == first.logical_id)
    result = base.model_copy(deep=True)
    targets = {a.logical_id: a for a in result.activities}
    changes = []
    cursor = ready
    for i in range(start, len(day)):
        item = day[i]
        original = seconds(item.local_start_time)
        proposed = max(original, cursor)
        if (item.fixed or item.booked or item.resolved) and proposed > original:
            raise DelayConflict(
                "DELAY_LOCK_CONFLICT",
                f"Keeping every existing gap would push past {item.user_label} at {display(item.local_start_time)}. It stays fixed. Review gaps or shorten flexible activities manually; nothing has changed.",
            )
        end = proposed + item.duration_minutes * 60
        if end > 86400:
            raise DelayConflict(
                "DELAY_MIDNIGHT",
                f"{item.user_label} would end after midnight. Review another day or shorten the plan manually; nothing has changed.",
            )
        if proposed > original:
            value = (
                datetime.combine(date(2000, 1, 1), time()) + timedelta(seconds=proposed)
            ).time()
            target = targets[item.logical_id]
            target.local_start_time = value
            changes.append(
                {
                    "activity_id": str(item.logical_id),
                    "label": item.user_label,
                    "before": display(item.local_start_time),
                    "after": display(value),
                    "minutes": item.duration_minutes,
                }
            )
        gap = (
            max(
                0,
                seconds(day[i + 1].local_start_time)
                - (original + item.duration_minutes * 60),
            )
            if i + 1 < len(day)
            else 0
        )
        cursor = end + gap
    blockers = [issue for issue in validate_plan(result)["issues"] if issue["blocking"]]
    if blockers:
        raise DelayConflict(
            "DELAY_PLAN_CONFLICT",
            "The complete saved plan has a timing or allocation conflict. Resolve it in the editor before preparing this delay adjustment. Nothing has changed.",
        )
    destination = next(
        s for s in base.stops if s.client_id == str(first.stop_logical_id)
    )
    return result, {
        "operation": "delay_day",
        "command": command.model_dump(mode="json"),
        "day": first.local_day_offset + 1,
        "destination": destination.name,
        "summary": "Only affected flexible start times on this day change. Durations, existing gaps, other days and commitments stay unchanged. No venue hours, travel times or reservations were rechecked.",
        "changes": changes,
    }


def validate_delay(base, candidate, metadata):
    expected, _ = delay_day(base, DayDelayInput.model_validate(metadata["command"]))
    if not same_plan(expected, candidate):
        raise ValueError("Candidate exceeds the approved day-delay command")
