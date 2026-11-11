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
from app.planning.resize import ResizeActivity, resize_activity, validate_resize


@pytest.mark.parametrize("duration", [0, -1, 181, 1440, 60])
def test_invalid_overlap_midnight_or_unchanged_duration_is_blocked(duration):
    plan, scope = test_reschedule.sample()
    original = plan.model_copy(deep=True)
    with pytest.raises(ValueError):
        resize_activity(
            plan,
            scope,
            ResizeActivity(
                activity_id=str(plan.activities[0].logical_id),
                duration_minutes=duration,
            ),
        )
    assert plan == original


@pytest.mark.parametrize("flag", ["fixed", "booked", "completed"])
def test_protected_duration_cannot_change(flag):
    plan, scope = test_reschedule.sample()
    setattr(plan.activities[0], flag, True)
    with pytest.raises(ValueError, match="fixed, booked or completed"):
        resize_activity(
            plan,
            scope,
            ResizeActivity(
                activity_id=str(plan.activities[0].logical_id), duration_minutes=45
            ),
        )


def test_resize_scope_and_exact_candidate_reconstruction():
    plan, scope = test_reschedule.sample()
    command = ResizeActivity(
        activity_id=str(plan.activities[0].logical_id), duration_minutes=45
    )
    candidate, metadata = resize_activity(plan, scope, command)
    validate_resize(plan, candidate, scope, metadata)
    assert candidate.activities[0].duration_minutes == 45
    assert (
        candidate.activities[0].local_start_time == plan.activities[0].local_start_time
    )
    assert candidate.activities[1] == plan.activities[1]
    candidate.activities[0].local_day_offset += 1
    with pytest.raises(ValueError):
        validate_resize(plan, candidate, scope, metadata)
    with pytest.raises(ValueError):
        resize_activity(plan, {**scope, "local_day_offset": 0}, command)
    with pytest.raises(ValueError):
        resize_activity(
            plan, scope, ResizeActivity(activity_id=str(uuid4()), duration_minutes=45)
        )


class ResizeProvider(test_conversation.FakeProvider):
    def __init__(self, activity_id, duration=45):
        super().__init__("resize")
        self.activity_id, self.duration = activity_id, duration

    def complete(self, messages, *, schema):
        if schema["title"] == "ResizeActivity":
            return {
                "content": json.dumps(
                    {"activity_id": self.activity_id, "duration_minutes": self.duration}
                )
            }
        return super().complete(messages, schema=schema)


def test_missing_duration_is_a_clarification_not_a_proposal():
    plan, scope = test_reschedule.sample()
    reply = respond(plan, scope, "Make it shorter", [], ResizeProvider("", 0))
    assert reply["kind"] == "clarify"
    assert "exact duration" in reply["text"]


@pytest.fixture
def context(monkeypatch):
    yield from test_conversation.context.__wrapped__(monkeypatch)


def test_duration_proposal_acceptance_preserves_start_and_other_items(context):
    client, db, identity = context
    plan, scope = test_reschedule.sample()
    trip = client.post(
        "/api/v1/trips",
        json={"title": "Duration test", "plan": plan.model_dump(mode="json")},
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    version_url = base + f"/versions/{trip['draft_version_id']}"
    tag = client.get(version_url).headers["etag"]
    body = {
        "text": "Make Museum visit 45 minutes",
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
        ResizeProvider(str(plan.activities[0].logical_id)),
    )
    candidate, metadata = reply.pop("candidate"), reply.pop("metadata")
    assert publish(db, job.id, job.lease_token, candidate, metadata)
    save_reply(db, job, reply)
    db.commit()
    assert client.get(version_url).headers["etag"] == tag
    proposal = client.get(base + f"/proposals/{job.proposal_id}").json()["data"]
    assert proposal["generation"]["change"]["after"] == "45 min"
    assert test_proposals.accept(client, base, proposal, ack=False).status_code == 409
    accepted = test_proposals.accept(client, base, proposal)
    assert accepted.status_code == 200, accepted.text
    by_id = {
        a["logical_id"]: a for a in client.get(version_url).json()["data"]["activities"]
    }
    activities = [by_id[str(a.logical_id)] for a in plan.activities]
    assert activities[0]["duration_minutes"] == 45
    assert activities[0]["local_start_time"] == "09:00:00"
    assert activities[0]["local_day_offset"] == 15
    assert activities[1]["duration_minutes"] == 60
