"""A single scoped time change, built and checked by deterministic code."""

import re
from datetime import time

from app.planning.validation import same_plan, validate_plan
from app.trips.schemas import StrictModel

MOVE_ISSUE = {
    "id": "AI_INTERPRETED_CHANGE:plan",
    "code": "AI_INTERPRETED_CHANGE",
    "activity_id": None,
    "blocking": False,
    "acknowledgeable": True,
    "detail": "AI interpreted the requested schedule change. Check the before and after values; opening hours and travel feasibility are not verified.",
}


class MoveActivity(StrictModel):
    activity_id: str
    local_start_time: str
    destination_day: int | None = None


def move_activity(base, scope, command):
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", command.local_start_time):
        raise ValueError("Choose an exact local start time, such as 11:00.")
    target = next(
        (a for a in base.activities if str(a.logical_id) == command.activity_id), None
    )
    if target is None or (
        str(target.stop_logical_id) != scope["stop_logical_id"]
        or target.local_day_offset != scope["local_day_offset"]
    ):
        raise ValueError("Choose one activity on the selected day in Plan first.")
    if target.fixed or target.booked or target.completed:
        raise ValueError(
            "That activity is fixed, booked or completed. It cannot be moved through chat. Review its protection in the plan editor first."
        )
    start = time.fromisoformat(command.local_start_time)
    destination = next(s for s in base.stops if s.client_id == scope["stop_logical_id"])
    new_day = (
        target.local_day_offset
        if command.destination_day is None
        else command.destination_day - 1
    )
    if (
        destination.desired_nights is None
        or not 0 <= new_day <= destination.desired_nights
    ):
        raise ValueError(
            "Choose a day within this destination’s stay. Day 1 is the first day here; destination days are different from whole-trip days."
        )
    if start == target.local_start_time and new_day == target.local_day_offset:
        raise ValueError(
            "That activity already starts at this time. Your plan is unchanged."
        )
    result = base.model_copy(deep=True)
    for activity in result.activities:
        if activity.logical_id == target.logical_id:
            activity.local_start_time = start
            activity.local_day_offset = new_day
    # Do not repair overlaps by moving another item or inventing a new time.
    blockers = [i for i in validate_plan(result)["issues"] if i["blocking"]]
    if blockers:
        raise ValueError(
            "That day and time do not fit the saved plan: "
            + blockers[0]["detail"]
            + " Choose another day or time, or resolve this in Plan."
        )
    return result, {
        "operation": "move_activity",
        "command": command.model_dump(),
        "summary": "Only this activity’s day and start time can change. Its duration and all other items stay the same.",
        "change": {
            "label": target.user_label,
            "before": target.local_start_time.strftime("%H:%M"),
            "after": start.strftime("%H:%M"),
            "day": target.local_day_offset + 1,
            "destination_day": new_day + 1,
            "destination": destination.name,
        },
    }


def validate_move(base, candidate, scope, metadata):
    expected, _ = move_activity(
        base, scope, MoveActivity.model_validate(metadata["command"])
    )
    if not same_plan(candidate, expected):
        raise ValueError("Candidate exceeds the single approved time change")
