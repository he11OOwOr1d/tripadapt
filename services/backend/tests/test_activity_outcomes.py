from uuid import UUID, uuid4

import pytest

from app.planning.removal import RemoveActivity, remove_activity
from app.planning.stay_rebalance import (
    RebalanceConflict,
    RebalanceInput,
    rebalance_stays,
)
from app.planning.validation import validate_plan
from app.trips.schemas import ActivityInput, PlanInput


def plan(**flags):
    stop = str(uuid4())
    acts = [
        dict(
            logical_id=str(uuid4()),
            stop_logical_id=stop,
            user_label=label,
            local_day_offset=1,
            local_start_time=start,
            duration_minutes=60,
            **f,
        )
        for label, start, f in [("Fort", "10:00", flags), ("Lunch", "10:30", {})]
    ]
    return (
        PlanInput.model_validate(
            dict(
                stops=[
                    dict(
                        client_id=stop,
                        name="Jaipur",
                        timezone="Asia/Kolkata",
                        desired_nights=2,
                    )
                ],
                activities=acts,
            )
        ),
        stop,
        acts,
    )


def codes(p):
    return {i["code"] for i in validate_plan(p)["issues"]}


def test_done_and_skipped_are_exclusive_and_skipped_never_overlaps():
    with pytest.raises(ValueError):
        ActivityInput(
            logical_id=uuid4(),
            stop_logical_id=uuid4(),
            user_label="x",
            local_day_offset=0,
            local_start_time="09:00",
            duration_minutes=30,
            completed=True,
            skipped=True,
        )
    planned, _, _ = plan()
    assert "OVERLAP" in codes(planned)
    skipped, _, _ = plan(skipped=True)
    # It did not happen, so it held no time and the lunch no longer clashes.
    assert "OVERLAP" not in codes(skipped)
    assert skipped.activities[0].resolved and not planned.activities[0].resolved


def test_skipped_activities_are_protected_like_completed_ones():
    p, stop, acts = plan(skipped=True)
    scope = {"stop_logical_id": stop, "local_day_offset": 1}
    with pytest.raises(ValueError, match="skipped"):
        remove_activity(p, scope, RemoveActivity(activity_id=acts[0]["logical_id"]))
    data = p.model_dump(mode="json")
    data["stops"].append(
        dict(
            client_id=str(uuid4()),
            name="Udaipur",
            timezone="Asia/Kolkata",
            desired_nights=2,
        )
    )
    two = PlanInput.model_validate(data)
    with pytest.raises(RebalanceConflict) as blocked:
        rebalance_stays(
            two,
            RebalanceInput(
                stop_id=stop,
                delta_nights=-2,
                counterpart=data["stops"][1]["client_id"],
                drop_activity_ids=[acts[1]["logical_id"]],
            ),
        )
    assert blocked.value.code == "REBALANCE_PROTECTED"
    assert blocked.value.activities[0]["label"] == "Fort"


def test_readiness_groups_skipped_separately_and_does_not_ask_again():
    from datetime import datetime, timezone
    from types import SimpleNamespace
    from zoneinfo import ZoneInfo

    from app.planning.readiness import readiness_report

    p, stop, acts = plan(skipped=True)
    now = datetime(2026, 11, 14, 13, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    body = SimpleNamespace(
        stop_id=UUID(stop),
        local_day_offset=1,
        local_date=now.date(),
        local_time="13:00",
        utc_offset_minutes=330,
    )
    report = readiness_report(p, body, now.astimezone(timezone.utc))
    assert [a.label for a in report["skipped"]] == ["Fort"]
    # The unresolved lunch still needs a decision; the skipped fort does not.
    unresolved = [a.label for a in report["past_unresolved"]]
    assert unresolved == ["Lunch"]
