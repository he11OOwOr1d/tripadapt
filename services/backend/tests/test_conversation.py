import json
from uuid import uuid4

import pytest
import test_trips
from pydantic import SecretStr
from sqlalchemy import select

from app.agents.conversation import respond
from app.api.identity import TrustedIdentity, verified_identity
from app.config import settings
from app.jobs.worker import claim, publish_reply
from app.main import app
from app.persistence.models import AppUser
from app.trips.schemas import PlanInput


class FakeProvider:
    def __init__(self, action="answer", topic="day", candidates=None):
        self.action, self.topic, self.candidates = action, topic, candidates or []

    def complete(self, messages, **kwargs):
        return {
            "content": json.dumps(
                {
                    "action": self.action,
                    "topic": self.topic,
                    "focus_stop_id": "",
                    "candidate_ids": self.candidates,
                }
            )
        }


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings, "planning_ai_enabled", True)
    monkeypatch.setattr(settings, "groq_api_key", SecretStr("test-only"))
    for result in test_trips.context.__wrapped__():
        result[1].expire_on_commit = False
        yield result


def setup(client):
    stop = str(uuid4())
    trip = client.post(
        "/api/v1/trips",
        json={
            "title": "Chat test",
            "plan": {
                "stops": [
                    {
                        "client_id": stop,
                        "name": "Jaipur",
                        "timezone": "Asia/Kolkata",
                        "desired_nights": 3,
                    }
                ]
            },
        },
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    tag = client.get(f"{base}/versions/{trip['draft_version_id']}").headers["etag"]
    body = {
        "text": "Explain this day",
        "base_version_id": trip["draft_version_id"],
        "scope": {
            "type": "selected_day",
            "stop_logical_id": stop,
            "local_day_offset": 0,
        },
    }
    return base, trip, tag, body


def send(client, base, tag, body, key=None):
    return client.post(
        base + "/messages",
        json=body,
        headers={"If-Match": tag, "Idempotency-Key": key or str(uuid4())},
    )


def test_message_idempotency_and_readonly_reply_survive_reload(context):
    client, db, identity = context
    base, trip, tag, body = setup(client)
    key = str(uuid4())
    response = send(client, base, tag, body, key)
    assert response.status_code == 202, response.text
    turn = response.json()["data"]
    assert send(client, base, tag, body, key).json()["data"]["id"] == turn["id"]
    assert (
        send(client, base, tag, {**body, "text": "Different"}, key).status_code == 409
    )
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    plan = PlanInput.model_validate(job.input["plan"])
    reply = respond(
        plan, job.input["request"]["scope"], body["text"], [], FakeProvider()
    )
    assert publish_reply(db, job.id, job.lease_token, reply)
    db.commit()
    page = client.get(base + "/messages").json()["data"]
    assert len(page["turns"]) == 1
    assert "No items" in page["turns"][0]["assistant_text"]
    assert page["turns"][0]["job"]["status"] == "succeeded"
    meta = client.get(base).json()["data"]
    assert meta["current_version_id"] is None
    assert meta["draft_version_id"] == trip["draft_version_id"]
    assert (
        client.get(base + f"/versions/{trip['draft_version_id']}").headers["etag"]
        == tag
    )


def test_messages_are_private_and_cursor_scoped(context):
    client, _, _ = context
    base, _, tag, body = setup(client)
    send(client, base, tag, body)
    assert client.get(base + f"/messages?before={uuid4()}").status_code == 400
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "other", str(uuid4()), "other@example.org", "other@example.org"
    )
    assert client.get(base + "/messages").status_code == 404
    assert send(client, base, tag, body).status_code == 404


def test_stale_or_empty_message_is_not_persisted(context):
    client, _, _ = context
    base, _, tag, body = setup(client)
    assert send(client, base, '"draft:wrong:0"', body).status_code == 412
    assert send(client, base, tag, {**body, "text": "   "}).status_code == 422
    assert client.get(base + "/messages").json()["data"]["turns"] == []


def test_clarification_and_supported_candidate_scope():
    stop = str(uuid4())
    plan = PlanInput.model_validate(
        {
            "stops": [
                {
                    "client_id": stop,
                    "name": "Place",
                    "timezone": "UTC",
                    "desired_nights": 20,
                }
            ]
        }
    )
    scope = {"stop_logical_id": stop, "local_day_offset": 15}
    clarification = respond(plan, scope, "Help", [], FakeProvider("clarify"))
    assert clarification["kind"] == "clarify" and len(clarification["choices"]) == 3
    proposal = respond(
        plan,
        scope,
        "Suggest a rest break",
        [],
        FakeProvider("plan", candidates=["rest"]),
    )
    assert proposal["kind"] == "proposal" and proposal["candidate_ids"] == ["rest"]
    unavailable = respond(
        plan, scope, "Book my flight", [], FakeProvider("unsupported")
    )
    assert "Nothing is booked" in unavailable["text"]


def test_chat_addition_becomes_reviewable_proposal_without_applying(context):
    from app.agents.day_graph import run_day_graph
    from app.jobs.worker import publish, save_reply

    client, db, identity = context
    base, trip, tag, body = setup(client)
    body["text"] = "Suggest a rest break"
    turn = send(client, base, tag, body).json()["data"]
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    plan = PlanInput.model_validate(job.input["plan"])
    scope = job.input["request"]["scope"]
    reply = respond(
        plan, scope, body["text"], [], FakeProvider("plan", candidates=["rest"])
    )

    class Planner:
        def complete(self, messages, *, tools=None, schema=None):
            if tools:
                return {"role": "assistant", "content": "Ready"}
            return {
                "content": json.dumps(
                    {
                        "summary": "A sample pause.",
                        "additions": [
                            {
                                "candidate_id": "rest",
                                "start": "14:00",
                                "reason": "Requested rest break.",
                            }
                        ],
                    }
                )
            }

    candidate, metadata = run_day_graph(
        plan,
        scope["stop_logical_id"],
        0,
        job.id,
        Planner(),
        instructions=body["text"],
        candidate_ids=reply["candidate_ids"],
    )
    assert publish(db, job.id, job.lease_token, candidate, metadata)
    save_reply(db, job, reply)
    db.commit()
    page = client.get(base + "/messages").json()["data"]
    assert page["turns"][0]["id"] == turn["id"]
    assert page["turns"][0]["kind"] == "proposal"
    proposal_id = page["turns"][0]["job"]["proposal_id"]
    proposal = client.get(base + f"/proposals/{proposal_id}").json()["data"]
    assert len(proposal["plan"]["activities"]) == 1
    assert proposal["plan"]["activities"][0]["kind"] == "rest"
    assert client.get(base).json()["data"]["current_version_id"] is None
    assert (
        client.get(base + f"/versions/{trip['draft_version_id']}").json()["data"][
            "activities"
        ]
        == []
    )


def test_quick_action_uses_selected_day_even_if_model_would_choose_summary():
    stop = str(uuid4())
    plan = PlanInput.model_validate(
        {
            "stops": [
                {
                    "client_id": stop,
                    "name": "Place",
                    "timezone": "UTC",
                    "desired_nights": 4,
                }
            ]
        }
    )
    answer = respond(
        plan,
        {"stop_logical_id": stop, "local_day_offset": 2},
        "Explain this day",
        [],
        FakeProvider("answer", "summary"),
    )
    assert "day 3, local time" in answer["text"]
    assert "Your saved route" not in answer["text"]
