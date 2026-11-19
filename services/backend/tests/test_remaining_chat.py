from uuid import UUID

import pytest
import test_conversation
from sqlalchemy import select

from app.agents.conversation import respond
from app.jobs.worker import claim, publish_reply
from app.persistence.models import AppUser, PlanVersion
from app.planning.remaining_handoff import validate_remaining_handoff
from app.trips.schemas import PlanInput


@pytest.fixture
def context(monkeypatch):
    yield from test_conversation.context.__wrapped__(monkeypatch)


def test_quick_request_is_a_readonly_confirmation_pointer_with_no_provider_facts():
    from test_reschedule import sample

    plan, scope = sample()
    before = plan.model_dump()

    class NeverProvider:
        def complete(self, *args, **kwargs):
            raise AssertionError("Shortcut needs no model")

    reply = respond(plan, scope, "Replan the rest of today", [], NeverProvider())
    assert reply["kind"] == "remaining_handoff" and reply["choices"] == []
    assert (
        "actual local time" in reply["text"]
        and "not assumed completed" in reply["text"]
    )
    assert (
        plan.model_dump() == before
        and "candidate" not in reply
        and "weather_focus" not in reply
    )
    natural = respond(
        plan,
        scope,
        "Help me rethink what is left today",
        [],
        test_conversation.FakeProvider("remaining_day"),
    )
    assert natural["kind"] == "remaining_handoff"


def test_durable_handoff_no_draft_change_reload_and_edit_staleness(context):
    client, db, identity = context
    base, trip, tag, body = test_conversation.setup(client)
    body["text"] = "Replan the rest of today"
    sent = test_conversation.send(client, base, tag, body)
    assert sent.status_code == 202, sent.text
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    reply = respond(
        PlanInput.model_validate(job.input["plan"]),
        body["scope"],
        body["text"],
        [],
        test_conversation.FakeProvider(),
    )
    assert publish_reply(db, job.id, job.lease_token, reply)
    db.commit()
    turn = client.get(base + "/messages").json()["data"]["turns"][0]
    assert turn["remaining_handoff"] == dict(
        type="remaining_day",
        stop_id=body["scope"]["stop_logical_id"],
        local_day_offset=0,
        base_etag=tag,
    )
    assert not turn["remaining_handoff_stale"] and turn["job"]["proposal_id"] is None
    assert (
        client.get(base + f"/versions/{trip['draft_version_id']}").headers["etag"]
        == tag
    )
    assert client.get(base).json()["data"]["current_version_id"] is None
    row = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    row.edit_sequence += 1
    db.commit()
    stale = client.get(base + "/messages").json()["data"]["turns"][0]
    assert stale["remaining_handoff_stale"]
    assert stale["remaining_handoff"]["base_etag"] == tag


@pytest.mark.parametrize("change", ["etag", "stop", "day"])
def test_invalid_pointer_never_substitutes_scope(change):
    from test_reschedule import sample

    plan, scope = sample()
    tag = f'"draft:{scope["stop_logical_id"]}:1"'
    pointer = dict(
        stop_id=scope["stop_logical_id"],
        local_day_offset=scope["local_day_offset"],
        base_etag=tag,
    )
    if change == "etag":
        pointer["base_etag"] = tag.replace(':1"', ':2"')
    if change == "stop":
        pointer["stop_id"] = "11111111-1111-4111-8111-111111111111"
    if change == "day":
        pointer["local_day_offset"] += 1
    with pytest.raises(ValueError):
        validate_remaining_handoff(plan, scope, pointer, tag)
