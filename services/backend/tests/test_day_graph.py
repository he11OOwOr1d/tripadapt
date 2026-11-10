import json
from uuid import uuid4

import pytest

from app.agents.day_graph import DayCandidate, run_day_graph
from app.agents.groq_provider import PlanningFailure
from app.trips.schemas import PlanInput


class FakeProvider:
    def __init__(self, outputs, tool_name="get_day_context"):
        self.outputs = iter(outputs)
        self.tool_name = tool_name
        self.schema_calls = 0
        self.tool_calls = 0

    def complete(self, messages, *, tools=None, schema=None):
        if tools:
            self.tool_calls += 1
            if self.tool_calls == 1:
                return {
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": "test",
                            "type": "function",
                            "function": {"name": self.tool_name, "arguments": "{}"},
                        }
                    ],
                }
            return {"role": "assistant", "content": "Ready"}
        assert schema["additionalProperties"] is False
        self.schema_calls += 1
        return {"role": "assistant", "content": next(self.outputs)}


def base():
    stop = str(uuid4())
    plan = PlanInput.model_validate(
        {
            "stops": [
                {
                    "client_id": stop,
                    "name": "Synthetic destination",
                    "timezone": "UTC",
                    "desired_nights": 20,
                }
            ],
            "activities": [
                {
                    "logical_id": str(uuid4()),
                    "stop_logical_id": stop,
                    "user_label": "Fixed morning",
                    "local_day_offset": 15,
                    "local_start_time": "09:00",
                    "duration_minutes": 60,
                    "fixed": True,
                    "completed": True,
                    "booked": True,
                }
            ],
        }
    )
    return plan, stop


def answer(start="11:00"):
    return json.dumps(
        {
            "summary": "A sample culture block with room around the fixed morning.",
            "additions": [
                {
                    "candidate_id": "culture",
                    "start": start,
                    "reason": "A sample option matching a slower day.",
                }
            ],
        }
    )


def test_graph_separates_tools_from_structured_output_and_preserves_items():
    plan, stop = base()
    provider = FakeProvider([answer()])
    result, metadata = run_day_graph(plan, stop, 15, uuid4(), provider)
    assert result.activities[0] == plan.activities[0]
    assert len(plan.activities) == 1 and len(result.activities) == 2
    assert provider.tool_calls == 2 and provider.schema_calls == 1
    assert metadata["evidence"] == "sample_catalog"
    assert set(metadata["tool_reads"]) == {
        "get_day_context",
        "list_activity_candidates",
    }
    assert (
        DayCandidate.model_validate_json(answer()).additions[0].candidate_id
        == "culture"
    )


def test_graph_repairs_overlap_once():
    plan, stop = base()
    provider = FakeProvider([answer("09:30"), answer("11:00")])
    result, _ = run_day_graph(plan, stop, 15, uuid4(), provider)
    assert (
        provider.schema_calls == 2 and result.activities[-1].local_start_time.hour == 11
    )


def test_graph_rejects_invalid_candidate_after_bounded_repair():
    plan, stop = base()
    provider = FakeProvider([answer("23:30"), "not json"])
    with pytest.raises(PlanningFailure, match="AI_CANDIDATE_INVALID"):
        run_day_graph(plan, stop, 15, uuid4(), provider)
    assert provider.schema_calls == 2


def test_graph_rejects_unpermitted_tools_before_execution():
    plan, stop = base()
    with pytest.raises(PlanningFailure, match="AI_TOOL_BUDGET_OR_SCOPE"):
        run_day_graph(plan, stop, 15, uuid4(), FakeProvider([], "execute_sql"))


def test_graph_checks_cancellation_at_boundaries():
    plan, stop = base()

    def cancelled(stage):
        raise PlanningFailure("AI_CANCELLED_OR_LEASE_LOST")

    with pytest.raises(PlanningFailure, match="AI_CANCELLED_OR_LEASE_LOST"):
        run_day_graph(plan, stop, 15, uuid4(), FakeProvider([]), cancelled)


def test_graph_allows_empty_day_proposal_without_inventing_places():
    plan, stop = base()
    provider = FakeProvider(
        [json.dumps({"summary": "Leave this day open.", "additions": []})]
    )
    result, _ = run_day_graph(plan, stop, 15, uuid4(), provider)
    assert result == plan


def test_candidate_evidence_guard_rejects_changed_labels():
    from app.agents.day_graph import validate_ai_candidate

    plan, stop = base()
    ident = uuid4()
    result, metadata = run_day_graph(plan, stop, 15, ident, FakeProvider([answer()]))
    validate_ai_candidate(plan, result, stop, 15, ident, metadata)
    result.activities[-1].user_label = "Invented place with a confirmed booking"
    with pytest.raises(ValueError):
        validate_ai_candidate(plan, result, stop, 15, ident, metadata)
