import json
from uuid import uuid4

import pytest
import test_conversation
import test_proposals
import test_reschedule
from sqlalchemy import select

from app.agents.conversation import respond
from app.jobs.worker import claim, publish, save_reply
from app.persistence.models import AppUser
from app.planning.removal import RemoveActivity, remove_activity, validate_removal


@pytest.mark.parametrize("flag", ["fixed", "booked", "completed"])
def test_protected_activity_cannot_be_removed(flag):
    plan, scope = test_reschedule.sample()
    setattr(plan.activities[0], flag, True)
    original = plan.model_copy(deep=True)
    with pytest.raises(ValueError, match="fixed, booked or completed"):
        remove_activity(
            plan, scope, RemoveActivity(activity_id=str(plan.activities[0].logical_id))
        )
    assert plan == original


def test_only_one_scoped_activity_can_leave_the_candidate():
    plan, scope = test_reschedule.sample()
    command = RemoveActivity(activity_id=str(plan.activities[0].logical_id))
    candidate, metadata = remove_activity(plan, scope, command)
    validate_removal(plan, candidate, scope, metadata)
    assert candidate.activities == [plan.activities[1]]
    assert len(plan.activities) == 2
    candidate.activities.clear()
    with pytest.raises(ValueError):
        validate_removal(plan, candidate, scope, metadata)
    with pytest.raises(ValueError):
        remove_activity(plan, {**scope, "local_day_offset": 0}, command)
    with pytest.raises(ValueError):
        remove_activity(plan, scope, RemoveActivity(activity_id=str(uuid4())))


def test_removing_last_item_is_valid_and_preserves_the_route():
    plan, scope = test_reschedule.sample()
    plan.activities.pop()
    candidate, _ = remove_activity(
        plan, scope, RemoveActivity(activity_id=str(plan.activities[0].logical_id))
    )
    assert candidate.activities == []
    assert candidate.stops == plan.stops


class RemoveProvider(test_conversation.FakeProvider):
    def __init__(self, activity_id):
        super().__init__("remove")
        self.activity_id = activity_id

    def complete(self, messages, *, schema):
        if schema["title"] == "RemoveActivity":
            return {"content": json.dumps({"activity_id": self.activity_id})}
        return super().complete(messages, schema=schema)


def test_ambiguous_removal_asks_without_a_candidate():
    plan, scope = test_reschedule.sample()
    reply = respond(plan, scope, "Clear things up", [], RemoveProvider(""))
    assert reply["kind"] == "clarify"
    assert "Which single activity" in reply["text"]
    assert "candidate" not in reply


@pytest.fixture
def context(monkeypatch):
    yield from test_conversation.context.__wrapped__(monkeypatch)


@pytest.mark.parametrize("outcome", ["accept", "discard", "stale"])
def test_removal_proposal_is_frozen_and_requires_explicit_current_acceptance(
    context, outcome
):
    client, db, identity = context
    plan, scope = test_reschedule.sample()
    trip = client.post(
        "/api/v1/trips",
        json={"title": "Removal test", "plan": plan.model_dump(mode="json")},
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    version_url = base + f"/versions/{trip['draft_version_id']}"
    tag = client.get(version_url).headers["etag"]
    body = {
        "text": "Remove Museum visit from this day",
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
        RemoveProvider(str(plan.activities[0].logical_id)),
    )
    candidate, metadata = reply.pop("candidate"), reply.pop("metadata")
    assert publish(db, job.id, job.lease_token, candidate, metadata)
    save_reply(db, job, reply)
    db.commit()
    assert client.get(version_url).headers["etag"] == tag
    assert len(client.get(version_url).json()["data"]["activities"]) == 2
    proposal = client.get(base + f"/proposals/{job.proposal_id}").json()["data"]
    assert proposal["generation"]["removal"]["label"] == "Museum visit"
    if outcome == "discard":
        assert (
            client.post(base + f"/proposals/{job.proposal_id}/discard").status_code
            == 200
        )
    elif outcome == "stale":
        response = client.post(
            base + "/draft/commands",
            headers={"If-Match": tag},
            json={
                "commands": [
                    {
                        "type": "activity.replace_user_schedule",
                        "activities": plan.model_dump(mode="json")["activities"],
                    }
                ]
            },
        )
        assert response.status_code == 200, response.text
        assert (
            test_proposals.accept(client, base, proposal).json()["code"]
            == "STALE_PROPOSAL"
        )
    else:
        assert (
            test_proposals.accept(client, base, proposal, ack=False).status_code == 409
        )
        accepted = test_proposals.accept(client, base, proposal)
        assert accepted.status_code == 200, accepted.text
    remaining = client.get(version_url).json()["data"]["activities"]
    assert len(remaining) == (1 if outcome == "accept" else 2)
    if outcome == "accept":
        assert remaining[0]["logical_id"] == str(plan.activities[1].logical_id)
