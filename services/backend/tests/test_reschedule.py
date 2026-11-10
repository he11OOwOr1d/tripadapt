import json
from uuid import uuid4

import pytest
import test_conversation
import test_proposals
from sqlalchemy import select

from app.agents.conversation import respond
from app.jobs.worker import claim, publish, save_reply
from app.persistence.models import AppUser
from app.planning.reschedule import MoveActivity, move_activity, validate_move
from app.trips.schemas import PlanInput


def sample():
    stop = str(uuid4())
    plan = PlanInput.model_validate(
        {
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
                    "user_label": "Museum visit",
                    "local_day_offset": 15,
                    "local_start_time": "09:00",
                    "duration_minutes": 60,
                },
                {
                    "logical_id": str(uuid4()),
                    "stop_logical_id": stop,
                    "user_label": "Lunch",
                    "local_day_offset": 15,
                    "local_start_time": "12:00",
                    "duration_minutes": 60,
                },
            ],
        }
    )
    return plan, {"stop_logical_id": stop, "local_day_offset": 15}


@pytest.mark.parametrize("flag", ["fixed", "booked", "completed"])
def test_protected_activity_cannot_move(flag):
    plan, scope = sample()
    setattr(plan.activities[0], flag, True)
    with pytest.raises(ValueError, match="fixed, booked or completed"):
        move_activity(
            plan,
            scope,
            MoveActivity(
                activity_id=str(plan.activities[0].logical_id), local_start_time="11:00"
            ),
        )


@pytest.mark.parametrize(
    "start", ["12:00", "11:30", "23:30", "25:00", "11:00:10", "09:00"]
)
def test_conflicts_invalid_times_and_noop_do_not_mutate(start):
    plan, scope = sample()
    original = plan.model_copy(deep=True)
    with pytest.raises(ValueError):
        move_activity(
            plan,
            scope,
            MoveActivity(
                activity_id=str(plan.activities[0].logical_id), local_start_time=start
            ),
        )
    assert plan == original


def test_scoped_move_keeps_every_other_field_and_rejects_tampering():
    plan, scope = sample()
    command = MoveActivity(
        activity_id=str(plan.activities[0].logical_id), local_start_time="11:00"
    )
    candidate, metadata = move_activity(plan, scope, command)
    validate_move(plan, candidate, scope, metadata)
    assert candidate.activities[1] == plan.activities[1]
    assert plan.activities[0].local_start_time.hour == 9
    candidate.activities[0].duration_minutes = 30
    with pytest.raises(ValueError):
        validate_move(plan, candidate, scope, metadata)
    with pytest.raises(ValueError):
        move_activity(plan, {**scope, "local_day_offset": 0}, command)
    with pytest.raises(ValueError):
        move_activity(plan, {**scope, "stop_logical_id": str(uuid4())}, command)


class MoveProvider(test_conversation.FakeProvider):
    def __init__(self, activity_id, start="11:00", destination_day=None):
        super().__init__("move")
        self.activity_id, self.start = activity_id, start
        self.destination_day = destination_day

    def complete(self, messages, *, schema):
        if schema["title"] == "MoveActivity":
            return {
                "content": json.dumps(
                    {
                        "activity_id": self.activity_id,
                        "local_start_time": self.start,
                        "destination_day": self.destination_day,
                    }
                )
            }
        return super().complete(messages, schema=schema)


def test_ambiguous_edit_asks_instead_of_guessing():
    plan, scope = sample()
    reply = respond(plan, scope, "Move it later", [], MoveProvider("", ""))
    assert reply["kind"] == "clarify"
    assert "exact time" in reply["text"]
    assert "candidate" not in reply


@pytest.fixture
def context(monkeypatch):
    yield from test_conversation.context.__wrapped__(monkeypatch)


@pytest.mark.parametrize("destination_day", [None, 17])
def test_chat_move_review_accept_reload_and_frozen_candidate(context, destination_day):
    client, db, identity = context
    plan, scope = sample()
    trip = client.post(
        "/api/v1/trips",
        json={"title": "Move test", "plan": plan.model_dump(mode="json")},
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    version_url = base + f"/versions/{trip['draft_version_id']}"
    tag = client.get(version_url).headers["etag"]
    body = {
        "text": "Move Museum visit to 11:00 AM"
        + (f" on day {destination_day} here" if destination_day else ""),
        "base_version_id": trip["draft_version_id"],
        "scope": {"type": "selected_day", **scope},
    }
    assert test_conversation.send(client, base, tag, body).status_code == 202
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    reply = respond(
        plan,
        scope,
        body["text"],
        [],
        MoveProvider(
            str(plan.activities[0].logical_id), destination_day=destination_day
        ),
    )
    candidate, metadata = reply.pop("candidate"), reply.pop("metadata")
    assert publish(db, job.id, job.lease_token, candidate, metadata)
    save_reply(db, job, reply)
    db.commit()
    assert client.get(version_url).headers["etag"] == tag
    assert (
        client.get(version_url).json()["data"]["activities"][0]["local_start_time"]
        == "09:00:00"
    )
    proposal = client.get(base + f"/proposals/{job.proposal_id}").json()["data"]
    assert proposal["generation"]["change"]["before"] == "09:00"
    assert test_proposals.accept(client, base, proposal, ack=False).status_code == 409
    response = test_proposals.accept(client, base, proposal)
    assert response.status_code == 200, response.text
    activities = client.get(version_url).json()["data"]["activities"]
    assert activities[0]["local_start_time"] == "11:00:00"
    assert activities[0]["local_day_offset"] == (15 if destination_day is None else 16)
    assert activities[1]["local_start_time"] == "12:00:00"
    assert (
        client.get(base + "/messages").json()["data"]["turns"][0]["kind"] == "proposal"
    )


@pytest.mark.parametrize("day", [0, -1, 22])
def test_destination_day_must_be_within_stay(day):
    plan, scope = sample()
    with pytest.raises(ValueError, match="within this destination"):
        move_activity(
            plan,
            scope,
            MoveActivity(
                activity_id=str(plan.activities[0].logical_id),
                local_start_time="11:00",
                destination_day=day,
            ),
        )


def test_cross_day_move_preserves_time_and_checks_target_conflicts():
    plan, scope = sample()
    command = MoveActivity(
        activity_id=str(plan.activities[0].logical_id),
        local_start_time="09:00",
        destination_day=17,
    )
    candidate, metadata = move_activity(plan, scope, command)
    validate_move(plan, candidate, scope, metadata)
    assert candidate.activities[0].local_day_offset == 16
    assert metadata["change"]["day"] == 16
    assert metadata["change"]["destination_day"] == 17
    assert candidate.activities[1] == plan.activities[1]
    plan.activities[1].local_day_offset = 16
    plan.activities[1].local_start_time = plan.activities[0].local_start_time
    with pytest.raises(ValueError, match="Overlaps"):
        move_activity(plan, scope, command)


def test_cross_day_candidate_cannot_change_destination_or_duration():
    plan, scope = sample()
    command = MoveActivity(
        activity_id=str(plan.activities[0].logical_id),
        local_start_time="11:00",
        destination_day=17,
    )
    candidate, metadata = move_activity(plan, scope, command)
    candidate.activities[0].stop_logical_id = uuid4()
    with pytest.raises(ValueError):
        validate_move(plan, candidate, scope, metadata)
