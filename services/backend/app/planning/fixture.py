"""Deterministic demonstration. No model, places, weather or availability calls."""

from uuid import UUID, uuid5

from app.trips.schemas import ActivityInput, PlanInput

FIXTURE_ISSUE = {
    "id": "FIXTURE_ONLY:plan",
    "code": "FIXTURE_ONLY",
    "activity_id": None,
    "blocking": False,
    "acknowledgeable": True,
    "detail": "These added meal/break blocks are test fixtures, not AI recommendations or verified travel suggestions.",
}


def generate_day(plan: PlanInput, stop_id: str, day: int, job_id: UUID) -> PlanInput:
    result = plan.model_copy(deep=True)
    existing = [
        a
        for a in result.activities
        if str(a.stop_logical_id) == stop_id and a.local_day_offset == day
    ]
    # Fill at most two open slots; never replace or shift an existing item.
    for kind, label, minutes, earliest in [
        ("rest", "Test suggestion: a pause", 20, 600),
        ("meal", "Test suggestion: lunch", 60, 720),
    ]:
        if any(a.kind == kind and a.user_label == label for a in existing):
            continue
        for start in range(earliest, 1021 - minutes, 15):
            if any(
                a.local_start_time.hour * 60 + a.local_start_time.minute
                < start + minutes
                and a.local_start_time.hour * 60
                + a.local_start_time.minute
                + a.duration_minutes
                > start
                for a in existing
            ):
                continue
            activity = ActivityInput(
                logical_id=uuid5(job_id, kind),
                stop_logical_id=stop_id,
                kind=kind,
                user_label=label,
                local_day_offset=day,
                local_start_time=f"{start // 60:02}:{start % 60:02}",
                duration_minutes=minutes,
            )
            result.activities.append(activity)
            existing.append(activity)
            break
    return result


def validate_scope(base: PlanInput, candidate: PlanInput, stop_id: str, day: int):
    """Fixtures may only add unprotected blocks on the requested day."""
    before = base.model_dump(mode="json")
    after = candidate.model_dump(mode="json")
    original = {str(a.logical_id): a for a in base.activities}
    current = {str(a.logical_id): a for a in candidate.activities}
    if len(current) != len(candidate.activities) or any(
        current.get(k) != a for k, a in original.items()
    ):
        raise ValueError("Existing activities must be unchanged")
    if {k: v for k, v in before.items() if k != "activities"} != {
        k: v for k, v in after.items() if k != "activities"
    }:
        raise ValueError("Only the selected schedule may change")
    for key, item in current.items():
        if key not in original and (
            str(item.stop_logical_id) != stop_id
            or item.local_day_offset != day
            or item.fixed
            or item.booked
            or item.completed
        ):
            raise ValueError("Candidate exceeds the requested scope")
