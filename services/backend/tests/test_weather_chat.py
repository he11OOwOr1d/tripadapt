import json
from uuid import UUID, uuid4

import pytest
import test_conversation
import test_reschedule
import test_weather_revisions
from sqlalchemy import select

from app.agents.conversation import respond
from app.api.proposals import plan_input
from app.jobs.worker import claim, publish_reply
from app.persistence.models import AppUser, PlanVersion
from app.trips.schemas import PlanInput


class ReplacementProvider(test_conversation.FakeProvider):
    def __init__(self, activity_id, visit_date="", category="museum"):
        super().__init__("replace")
        self.activity_id, self.visit_date, self.category = (
            activity_id,
            visit_date,
            category,
        )

    def complete(self, messages, *, schema):
        if schema["title"] == "ReplacementFocus":
            return {
                "content": json.dumps(
                    dict(
                        activity_id=self.activity_id,
                        visit_date=self.visit_date,
                        category=self.category,
                    )
                )
            }
        return super().complete(messages, schema=schema)


def sample():
    plan, scope = test_reschedule.sample()
    plan.stops[0].place_reference_id = uuid4()
    return plan, scope


def test_replacement_request_is_a_readonly_handoff_not_a_candidate():
    plan, scope = sample()
    original = plan.model_copy(deep=True)
    target = plan.activities[0]
    reply = respond(
        plan,
        scope,
        "Find a gallery alternative to Museum visit on 2026-11-14",
        [],
        ReplacementProvider(str(target.logical_id), "2026-11-14", "gallery"),
        evidence="places",
    )
    assert reply["kind"] == "weather_handoff"
    assert reply["weather_focus"] == dict(
        activity_id=str(target.logical_id), category="gallery", visit_date="2026-11-14"
    )
    assert "09:00" in reply["text"] and "60 minutes" in reply["text"]
    assert "candidate" not in reply and plan == original
    reply = respond(
        plan,
        scope,
        "Find an indoor alternative to Museum visit",
        [],
        ReplacementProvider(str(target.logical_id)),
        evidence="places",
    )
    assert reply["weather_focus"]["visit_date"] is None


@pytest.mark.parametrize(
    "case",
    [
        "ambiguous",
        "unknown",
        "wrong_day",
        "fixed",
        "booked",
        "completed",
        "duplicate",
        "unmapped",
        "sample",
        "invented_date",
        "invalid_date",
    ],
)
def test_unclear_or_invalid_requests_do_not_open_a_chooser(case):
    plan, scope = sample()
    target = plan.activities[0]
    ident = str(target.logical_id)
    date = ""
    if case == "ambiguous":
        ident = ""
    if case == "unknown":
        ident = str(uuid4())
    if case == "wrong_day":
        target.local_day_offset += 1
    if case in ("fixed", "booked", "completed"):
        setattr(target, case, True)
    if case == "duplicate":
        plan.activities[1].user_label = target.user_label.upper()
    if case == "unmapped":
        plan.stops[0].place_reference_id = None
    if case == "invented_date":
        date = "2026-11-14"
    if case == "invalid_date":
        date = "2026-02-31"
    reply = respond(
        plan,
        scope,
        "Find an alternative to Museum visit",
        [],
        ReplacementProvider(ident, date),
        evidence="sample" if case == "sample" else "places",
    )
    assert reply["kind"] == "clarify"
    assert "weather_focus" not in reply and "candidate" not in reply


def test_exact_trip_date_conflicts_are_explained():
    plan, scope = sample()
    from datetime import date

    plan.date_mode, plan.start_date = "exact", date(2026, 11, 1)
    reply = respond(
        plan,
        scope,
        "Find an alternative to Museum visit on 2026-11-14",
        [],
        ReplacementProvider(str(plan.activities[0].logical_id), "2026-11-14"),
        evidence="places",
    )
    assert reply["kind"] == "clarify" and "2026-11-16" in reply["text"]


@pytest.fixture
def context(monkeypatch):
    yield from test_conversation.context.__wrapped__(monkeypatch)


def test_durable_handoff_survives_reload_but_not_new_edits(context, monkeypatch):
    client, db, identity = context
    base, version, trip, tag, body, _, _ = test_weather_revisions.setup(
        client, monkeypatch
    )
    plan = plan_input(db, db.get(PlanVersion, UUID(trip["draft_version_id"])))
    scope = dict(
        type="selected_day", stop_logical_id=plan.stops[0].client_id, local_day_offset=0
    )
    db.commit()
    message = dict(
        text="Find a museum alternative to Walk",
        evidence="places",
        base_version_id=trip["draft_version_id"],
        scope=scope,
    )
    first = test_conversation.send(client, base, tag, message)
    assert first.status_code == 202, first.text
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    reply = respond(
        PlanInput.model_validate(job.input["plan"]),
        scope,
        message["text"],
        [],
        ReplacementProvider(body["activity_id"]),
        evidence="places",
    )
    assert publish_reply(db, job.id, job.lease_token, reply)
    db.commit()
    turn = client.get(base + "/messages").json()["data"]["turns"][0]
    assert turn["weather_handoff"]["base_etag"] == tag
    assert turn["weather_handoff"]["activity_id"] == body["activity_id"]
    assert not turn["weather_handoff_stale"]
    assert turn["job"]["proposal_id"] is None and turn["job"]["status"] == "succeeded"
    assert client.get(version).headers["etag"] == tag
    assert client.get(base + "/proposals").json()["data"]["reviews"] == []
    draft = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    draft.edit_sequence += 1
    db.commit()
    turn = client.get(base + "/messages").json()["data"]["turns"][0]
    assert turn["weather_handoff_stale"] and turn["weather_handoff"]["base_etag"] == tag


def test_invalid_handoff_cannot_be_published(context, monkeypatch):
    client, db, identity = context
    base, _, trip, tag, _, _, _ = test_weather_revisions.setup(client, monkeypatch)
    plan = plan_input(db, db.get(PlanVersion, UUID(trip["draft_version_id"])))
    scope = dict(
        type="selected_day", stop_logical_id=plan.stops[0].client_id, local_day_offset=0
    )
    db.commit()
    message = dict(
        text="Find an alternative",
        evidence="places",
        base_version_id=trip["draft_version_id"],
        scope=scope,
    )
    test_conversation.send(client, base, tag, message)
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    with pytest.raises(ValueError):
        publish_reply(
            db,
            job.id,
            job.lease_token,
            dict(
                kind="weather_handoff",
                text="Untrusted",
                choices=[],
                weather_focus=dict(
                    activity_id=str(uuid4()), category="museum", visit_date=None
                ),
            ),
        )
