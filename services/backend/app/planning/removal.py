"""A reviewed removal of exactly one unprotected activity on the selected day."""

from app.planning.validation import same_plan, validate_plan
from app.trips.schemas import StrictModel


class RemoveActivity(StrictModel):
    activity_id: str


def remove_activity(base, scope, command):
    target = next(
        (a for a in base.activities if str(a.logical_id) == command.activity_id), None
    )
    if (
        target is None
        or str(target.stop_logical_id) != scope["stop_logical_id"]
        or target.local_day_offset != scope["local_day_offset"]
    ):
        raise ValueError(
            "Select the relevant day in Plan first, then name one activity to remove."
        )
    if target.fixed or target.booked or target.completed:
        raise ValueError(
            "That activity is fixed, booked or completed. It cannot be removed through chat. No reservation has been cancelled."
        )
    candidate = base.model_copy(deep=True)
    candidate.activities = [
        a for a in candidate.activities if a.logical_id != target.logical_id
    ]
    blockers = [i for i in validate_plan(candidate)["issues"] if i["blocking"]]
    if blockers:
        raise ValueError(
            "This plan still needs attention before a removal can be accepted: "
            + blockers[0]["detail"]
            + " Resolve this in Plan first. Nothing has changed."
        )
    destination = next(s for s in base.stops if s.client_id == scope["stop_logical_id"])
    return candidate, {
        "operation": "remove_activity",
        "command": command.model_dump(),
        "summary": "Only the named activity is removed. All other items and trip settings stay the same.",
        "removal": {
            "label": target.user_label,
            "day": target.local_day_offset + 1,
            "destination": destination.name,
            "start": target.local_start_time.strftime("%H:%M"),
            "duration_minutes": target.duration_minutes,
        },
    }


def validate_removal(base, candidate, scope, metadata):
    expected, _ = remove_activity(
        base, scope, RemoveActivity.model_validate(metadata["command"])
    )
    if not same_plan(candidate, expected):
        raise ValueError("Candidate exceeds the single requested removal")
