from uuid import UUID

import pytest
import test_conversation as chat
import test_planning_jobs as planning
from sqlalchemy import select

from app.agents.conversation import respond
from app.config import settings
from app.jobs.worker import claim, publish, publish_reply
from app.persistence.models import AppUser, PlanProposal, Trip
from app.trips.schemas import PlanInput


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings, "planning_fixtures_enabled", True)
    yield from chat.context.__wrapped__(monkeypatch)


def set_lifecycle(db, trip, state):
    row = db.get(Trip, UUID(trip["id"]))
    row.lifecycle = state
    row.lock_version += 1
    db.commit()


def queued(context, state="active", text="Replan the rest of today"):
    client, db, identity = context
    base, trip, tag, body = chat.setup(client)
    set_lifecycle(db, trip, state)
    body["text"] = text
    sent = chat.send(client, base, tag, body)
    assert sent.status_code == 202, sent.text
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    return base, trip, tag, body, job


def test_active_handoff_is_durable_and_creates_no_proposal(context):
    client, db, _ = context
    base, trip, tag, body, job = queued(context)
    assert job.input["trip_lifecycle"] == "active"
    reply = respond(
        PlanInput.model_validate(job.input["plan"]),
        body["scope"],
        body["text"],
        [],
        chat.FakeProvider(),
        lifecycle="active",
    )
    assert publish_reply(db, job.id, job.lease_token, reply)
    db.commit()
    turn = client.get(base + "/messages").json()["data"]["turns"][0]
    assert (
        turn["remaining_handoff"]["base_etag"] == tag
        and not turn["remaining_handoff_stale"]
    )
    assert turn["job"]["proposal_id"] is None
    assert client.get(base).json()["data"]["lifecycle"] == "active"
    assert (
        client.get(base + f"/versions/{trip['draft_version_id']}").headers["etag"]
        == tag
    )


@pytest.mark.parametrize(
    "action",
    ["plan", "move", "resize", "remove", "replace", "relax", "clarify", "unsupported"],
)
def test_active_router_never_prepares_agent_edits(action):
    from test_reschedule import sample

    plan, scope = sample()
    before = plan.model_dump()
    reply = respond(
        plan,
        scope,
        "Make changes for me",
        [],
        chat.FakeProvider(action),
        lifecycle="active",
    )
    assert reply["kind"] == "clarify" and "active trip" in reply["text"]
    assert (
        "candidate" not in reply
        and "weather_focus" not in reply
        and "candidate_ids" not in reply
    )
    assert reply["choices"] == ["Replan the rest of today", "Explain this day"]
    assert plan.model_dump() == before


@pytest.mark.parametrize("state", ["active", "completed", "archived"])
def test_nonplanning_generation_is_rejected_at_admission(context, state):
    client, db, _ = context
    base, trip, tag, body = planning.setup(client)
    set_lifecycle(db, trip, state)
    response = planning.create(client, base, tag, body)
    assert response.status_code == 409, response.text
    assert response.json()["code"] == (
        "AGENT_PLANNING_ONLY" if state == "active" else "TRIP_CHAT_CLOSED"
    )


@pytest.mark.parametrize("state", ["completed", "archived"])
def test_closed_trip_rejects_new_chat_but_keeps_history_readable(context, state):
    client, db, _ = context
    base, trip, tag, body = chat.setup(client)
    set_lifecycle(db, trip, state)
    denied = chat.send(client, base, tag, body)
    assert denied.status_code == 409 and denied.json()["code"] == "TRIP_CHAT_CLOSED"
    assert client.get(base + "/messages").status_code == 200


@pytest.mark.parametrize("changed", ["active", "completed", "archived"])
def test_lifecycle_change_fences_queued_reply(context, changed):
    client, db, _ = context
    base, trip, tag, body, job = queued(context, state="planning")
    set_lifecycle(db, trip, changed)
    assert not publish_reply(
        db, job.id, job.lease_token, dict(kind="answer", text="Old context", choices=[])
    )
    assert job.status == "superseded" and job.proposal_id is None


def test_publication_defends_against_router_regressions(context):
    client, db, _ = context
    base, trip, tag, body, job = queued(context)
    plan = PlanInput.model_validate(job.input["plan"])
    assert not publish(db, job.id, job.lease_token, plan)
    assert (
        job.status == "failed"
        and job.error_code == "AGENT_PLANNING_ONLY"
        and job.proposal_id is None
    )
    assert (
        db.scalar(
            select(PlanProposal.id).where(PlanProposal.trip_id == UUID(trip["id"]))
        )
        is None
    )


def test_active_reply_cannot_smuggle_candidate_or_weather_chooser(context):
    client, db, _ = context
    base, trip, tag, body, job = queued(context)
    assert not publish_reply(
        db,
        job.id,
        job.lease_token,
        dict(
            kind="weather_handoff",
            text="Choose replacements",
            choices=[],
            weather_focus={},
        ),
    )
    assert job.status == "failed" and job.error_code == "ACTIVE_CHAT_READ_ONLY"


def test_old_pending_agent_proposal_cannot_be_accepted_after_activation(context):
    import test_proposals

    from app.persistence.models import PlanningJob

    client, db, _ = context
    base, trip, tag, body = planning.setup(client)
    admitted = planning.create(client, base, tag, body).json()["data"]
    owner = db.get(PlanningJob, UUID(admitted["id"])).owner_id
    job = claim(db, owner_id=owner)
    assert publish(db, job.id, job.lease_token, planning.candidate(job))
    ident = job.proposal_id
    db.commit()
    proposal = client.get(base + f"/proposals/{ident}").json()["data"]
    set_lifecycle(db, trip, "active")
    response = test_proposals.accept(client, base, proposal)
    assert (
        response.status_code == 409 and response.json()["code"] == "AGENT_PLANNING_ONLY"
    )
    assert (
        client.get(base + f"/proposals/{ident}").json()["data"]["status"] == "pending"
    )


def test_guarded_user_remaining_day_proposal_still_works_while_active(
    context, monkeypatch
):
    import test_proposals
    import test_remaining_proposals as remaining

    values = remaining.setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    set_lifecycle(db, trip, "active")
    saved = remaining.save(values)
    assert saved.status_code == 201, saved.text
    accepted = test_proposals.accept(client, base, saved.json()["data"])
    assert accepted.status_code == 200, accepted.text
    assert client.get(base).json()["data"]["lifecycle"] == "active"


def test_leaving_and_returning_to_planning_still_supersedes_old_work(context):
    client, db, _ = context
    base, trip, tag, body, job = queued(context, state="planning")
    set_lifecycle(db, trip, "active")
    set_lifecycle(db, trip, "planning")
    assert not publish_reply(
        db, job.id, job.lease_token, dict(kind="answer", text="Old epoch", choices=[])
    )
    assert job.status == "superseded"
