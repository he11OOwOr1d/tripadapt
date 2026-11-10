"""Only an existing unprotected activity's duration may change."""

from app.planning.validation import validate_plan
from app.trips.schemas import StrictModel


class ResizeActivity(StrictModel):
    activity_id: str
    duration_minutes: int


def resize_activity(base, scope, command):
    target = next(
        (a for a in base.activities if str(a.logical_id) == command.activity_id), None
    )
    if (
        target is None
        or str(target.stop_logical_id) != scope["stop_logical_id"]
        or target.local_day_offset != scope["local_day_offset"]
    ):
        raise ValueError(
            "Select the activity’s day in Plan first, then name one activity to resize."
        )
    if target.fixed or target.booked or target.completed:
        raise ValueError(
            "That activity is fixed, booked or completed. Its duration cannot change through chat."
        )
    if command.duration_minutes <= 0:
        raise ValueError(
            "Choose an exact positive duration, for example 45 minutes. Nothing has changed."
        )
    if target.duration_minutes == command.duration_minutes:
        raise ValueError(
            "That activity already has this duration. Your plan is unchanged."
        )
    candidate = base.model_copy(deep=True)
    for item in candidate.activities:
        if item.logical_id == target.logical_id:
            item.duration_minutes = command.duration_minutes
    blockers = [i for i in validate_plan(candidate)["issues"] if i["blocking"]]
    if blockers:
        raise ValueError(
            "That duration does not fit the saved plan: "
            + blockers[0]["detail"]
            + " Choose a shorter duration or resolve this in Plan. Other activities have not moved."
        )
    destination = next(s for s in base.stops if s.client_id == scope["stop_logical_id"])
    return candidate, {
        "operation": "resize_activity",
        "command": command.model_dump(),
        "summary": "Only this activity’s duration changes. Its day, start time and all other items stay the same.",
        "change": {
            "label": target.user_label,
            "before": f"{target.duration_minutes} min",
            "after": f"{command.duration_minutes} min",
            "day": target.local_day_offset + 1,
            "destination_day": target.local_day_offset + 1,
            "destination": destination.name,
            "start": target.local_start_time.strftime("%H:%M"),
        },
    }


def validate_resize(base, candidate, scope, metadata):
    expected, _ = resize_activity(
        base, scope, ResizeActivity.model_validate(metadata["command"])
    )
    if candidate != expected:
        raise ValueError("Candidate exceeds the single requested duration change")
