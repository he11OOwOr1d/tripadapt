from uuid import uuid4

import pytest

from app.planning.validation import validate_plan
from app.trips.schemas import PlanInput


def make_plan(**changes):
    stop = str(uuid4())
    data = {
        "stops": [
            {
                "client_id": stop,
                "name": "Jaipur",
                "timezone": "Asia/Kolkata",
                "desired_nights": 20,
            }
        ],
        "activities": [
            {
                "logical_id": str(uuid4()),
                "stop_logical_id": stop,
                "user_label": "Walk",
                "local_day_offset": 15,
                "local_start_time": "09:00",
                "duration_minutes": 60,
            }
        ],
    }
    data.update(changes)
    return PlanInput.model_validate(data)


def codes(plan):
    return {i["code"] for i in validate_plan(plan)["issues"] if i["blocking"]}


def test_long_undated_manual_plan_remains_provisional():
    report = validate_plan(make_plan())
    assert report["status"] == "provisional"
    assert not any(i["blocking"] for i in report["issues"])
    assert report["issues"][0]["acknowledgeable"]


@pytest.mark.parametrize(
    "field,value,code",
    [
        ("local_start_time", "23:45", "CROSSES_MIDNIGHT"),
        ("local_start_time", "09:00:20", "MINUTE_PRECISION_REQUIRED"),
        ("local_start_time", "09:00+05:30", "LOCAL_TIME_REQUIRED"),
        ("local_day_offset", 30, "DAY_OUTSIDE_STAY"),
    ],
)
def test_invalid_schedule_blocks_acceptance(field, value, code):
    plan = make_plan().model_dump(mode="json")
    plan["activities"][0][field] = value
    assert code in codes(PlanInput.model_validate(plan))


def test_route_overallocation_and_strict_budget_block():
    assert "DURATION_CONFLICT" in codes(
        make_plan(date_mode="duration", desired_days=10)
    )
    assert "STRICT_BUDGET_UNVERIFIED" in codes(
        make_plan(budget={"amount": "100", "mode": "strict"})
    )
    assert "WINDOW_CONFLICT" in codes(
        make_plan(
            date_mode="window",
            desired_days=30,
            window_start="2026-12-01",
            window_end="2026-12-10",
        )
    )
