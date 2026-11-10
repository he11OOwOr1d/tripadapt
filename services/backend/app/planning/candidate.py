"""Recheck the same bounded candidate at publication and acceptance."""

from app.trips.schemas import PlanInput


def validate_job_candidate(payload, candidate, job_id, metadata):
    from app.agents.day_graph import AI_ISSUE, validate_ai_candidate
    from app.planning.fixture import FIXTURE_ISSUE, validate_scope
    from app.planning.removal import validate_removal
    from app.planning.reschedule import MOVE_ISSUE, validate_move
    from app.planning.resize import validate_resize

    base = PlanInput.model_validate(payload["plan"])
    request = payload["request"]
    scope = request["scope"]
    validators = {
        "move_activity": validate_move,
        "resize_activity": validate_resize,
        "remove_activity": validate_removal,
    }
    if metadata.get("operation") in validators:
        if request["operation"] != "chat" or request["engine"] != "groq":
            raise ValueError("Schedule edits require a conversation request")
        validator = validators[metadata["operation"]]
        validator(base, candidate, scope, metadata)
        return MOVE_ISSUE
    validate_scope(base, candidate, scope["stop_logical_id"], scope["local_day_offset"])
    if request["engine"] == "groq":
        validate_ai_candidate(
            base,
            candidate,
            scope["stop_logical_id"],
            scope["local_day_offset"],
            job_id,
            metadata,
        )
        return AI_ISSUE
    return FIXTURE_ISSUE
