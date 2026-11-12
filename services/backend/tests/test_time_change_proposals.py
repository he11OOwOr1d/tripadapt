from uuid import UUID, uuid4

import pytest
import test_trips
from sqlalchemy import select

from app.api.identity import verified_identity
from app.main import app
from app.persistence.models import Activity, PlanVersion


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def setup(client, **protection):
    stop = str(uuid4())
    target = str(uuid4())
    activities = [
        dict(
            logical_id=str(uuid4()),
            stop_logical_id=stop,
            user_label="Earlier",
            local_day_offset=0,
            local_start_time="10:00",
            duration_minutes=60,
            fixed=True,
        ),
        dict(
            logical_id=target,
            stop_logical_id=stop,
            user_label="Museum",
            local_day_offset=0,
            local_start_time="11:10",
            duration_minutes=60,
            **protection,
        ),
    ]
    trip = client.post(
        "/api/v1/trips",
        json={
            "title": "Time change QA",
            "plan": {
                "stops": [
                    {
                        "client_id": stop,
                        "name": "Jaipur",
                        "timezone": "Asia/Kolkata",
                        "desired_nights": 12,
                    }
                ],
                "activities": activities,
            },
        },
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    tag = client.get(base + f"/versions/{trip['draft_version_id']}").headers["etag"]
    return base, trip, tag, {"activity_id": target, "local_start_time": "11:40"}


def propose(client, base, tag, body, key=None):
    return client.post(
        base + "/proposals/time-change",
        json=body,
        headers={"If-Match": tag, "Idempotency-Key": key or str(uuid4())},
    )


def accept(client, base, proposal, key=None):
    return client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": key or str(uuid4())},
        json={
            "expected_current_version_id": proposal["base_current_version_id"],
            "acknowledged_issue_ids": [
                i["id"]
                for i in proposal["validation"]["issues"]
                if i["acknowledgeable"]
            ],
        },
    )


def test_single_move_is_frozen_idempotent_and_only_applied_on_accept(context):
    client, db, _ = context
    base, trip, tag, body = setup(client)
    key = str(uuid4())
    first = propose(client, base, tag, body, key)
    assert first.status_code == 201, first.text
    proposal = first.json()["data"]
    assert proposal["generation"]["operation"] == "move_activity"
    assert proposal["generation"]["change"]["before"] == "11:10"
    assert propose(client, base, tag, body, key).json()["data"]["id"] == proposal["id"]
    assert (
        propose(
            client, base, tag, {**body, "local_start_time": "12:00"}, key
        ).status_code
        == 409
    )
    assert (
        client.post(
            base + "/draft/submit", headers={"If-Match": tag, "Idempotency-Key": key}
        ).status_code
        == 409
    )
    draft = client.get(base + f"/versions/{trip['draft_version_id']}").json()["data"]
    assert (
        next(a for a in draft["activities"] if a["logical_id"] == body["activity_id"])[
            "local_start_time"
        ]
        == "11:10:00"
    )
    accept_key = str(uuid4())
    accepted = accept(client, base, proposal, accept_key)
    assert accepted.status_code == 200, accepted.text
    assert accept(client, base, proposal, accept_key).status_code == 200
    current = client.get(base + f"/versions/{trip['draft_version_id']}").json()["data"]
    changed = next(
        a for a in current["activities"] if a["logical_id"] == body["activity_id"]
    )
    assert (
        changed["local_start_time"] == "11:40:00" and changed["duration_minutes"] == 60
    )
    assert (
        next(
            a for a in current["activities"] if a["logical_id"] != body["activity_id"]
        )["local_start_time"]
        == "10:00:00"
    )
    assert client.get(base + "/revisions").json()["data"]["revisions"]


@pytest.mark.parametrize("field", ["fixed", "booked", "completed"])
def test_protected_targets_cannot_be_proposed(context, field):
    client, _, _ = context
    base, _, tag, body = setup(client, **{field: True})
    assert propose(client, base, tag, body).status_code == 409


@pytest.mark.parametrize("start", ["10:30", "23:30"])
def test_conflict_or_midnight_is_rejected(context, start):
    client, _, _ = context
    base, _, tag, body = setup(client)
    assert (
        propose(client, base, tag, {**body, "local_start_time": start}).status_code
        == 409
    )


def test_preconditions_scope_and_auth(context):
    client, _, _ = context
    base, _, tag, body = setup(client)
    assert client.post(base + "/proposals/time-change", json=body).status_code == 428
    assert propose(client, base, '"stale"', body).status_code == 412
    assert (
        propose(client, base, tag, {**body, "activity_id": str(uuid4())}).status_code
        == 404
    )
    assert (
        propose(client, base, tag, {**body, "local_start_time": "24:00"}).status_code
        == 422
    )
    app.dependency_overrides.pop(verified_identity)
    assert propose(client, base, tag, body).status_code == 401


def test_changed_draft_cannot_accept_old_move(context):
    client, db, _ = context
    base, trip, tag, body = setup(client)
    proposal = propose(client, base, tag, body).json()["data"]
    draft = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    draft.edit_sequence += 1
    db.commit()
    response = accept(client, base, proposal)
    assert response.status_code == 409 and response.json()["code"] == "STALE_PROPOSAL"


def test_acceptance_rebuilds_command_and_rejects_tampered_candidate(context):
    client, db, _ = context
    base, _, tag, body = setup(client)
    proposal = propose(client, base, tag, body).json()["data"]
    item = db.scalar(
        select(Activity).where(
            Activity.version_id == UUID(proposal["candidate_version_id"])
        )
    )
    item.duration_minutes += 5
    db.commit()
    response = accept(client, base, proposal)
    assert response.status_code == 409 and response.json()["code"] == "PLAN_CONFLICT"


def test_discard_does_not_apply_the_suggestion(context):
    client, _, _ = context
    base, trip, tag, body = setup(client)
    proposal = propose(client, base, tag, body).json()["data"]
    response = client.post(base + f"/proposals/{proposal['id']}/discard")
    assert response.status_code == 200
    draft = client.get(base + f"/versions/{trip['draft_version_id']}").json()["data"]
    assert (
        next(a for a in draft["activities"] if a["logical_id"] == body["activity_id"])[
            "local_start_time"
        ]
        == "11:10:00"
    )
    assert accept(client, base, proposal).status_code == 409


def test_other_owner_cannot_prepare_or_read_the_move(context):
    from app.api.identity import TrustedIdentity

    client, _, _ = context
    base, _, tag, body = setup(client)
    proposal = propose(client, base, tag, body).json()["data"]
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "test-issuer", str(uuid4()), "other@example.org", "other@example.org"
    )
    assert propose(client, base, tag, body).status_code == 404
    assert client.get(base + f"/proposals/{proposal['id']}").status_code == 404
