from uuid import uuid4

import pytest
import test_trips


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def setup(client, *, overlap=False):
    stop = str(uuid4())
    activities = [
        dict(
            logical_id=str(uuid4()),
            stop_logical_id=stop,
            user_label="Walk",
            local_day_offset=0,
            local_start_time="09:00",
            duration_minutes=60,
            fixed=True,
        )
    ]
    if overlap:
        activities.append(
            {**activities[0], "logical_id": str(uuid4()), "user_label": "Lunch"}
        )
    trip = client.post(
        "/api/v1/trips",
        json={
            "title": "Proposal check",
            "plan": {
                "stops": [
                    dict(
                        client_id=stop,
                        name="Jaipur",
                        timezone="Asia/Kolkata",
                        desired_nights=2,
                    )
                ],
                "activities": activities,
            },
        },
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    version = client.get(f"{base}/versions/{trip['draft_version_id']}")
    return base, trip, version.headers["etag"]


def submit(client, base, tag, key=None):
    return client.post(
        base + "/draft/submit",
        headers={"If-Match": tag, "Idempotency-Key": key or str(uuid4())},
    )


def accept(client, base, proposal, key=None, ack=True):
    return client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": key or str(uuid4())},
        json={
            "expected_current_version_id": proposal["base_current_version_id"],
            "acknowledged_issue_ids": [
                i["id"]
                for i in proposal["validation"]["issues"]
                if i["acknowledgeable"]
            ]
            if ack
            else [],
        },
    )


def test_accept_frozen_copy_retry_and_keep_editable_draft(context):
    client, db, identity = context
    base, trip, tag = setup(client)
    key = str(uuid4())
    response = submit(client, base, tag, key)
    assert response.status_code == 201, response.text
    proposal = response.json()["data"]
    assert submit(client, base, tag, key).json()["data"]["id"] == proposal["id"]
    assert client.get(base).json()["data"]["current_version_id"] is None
    assert (
        accept(client, base, proposal, ack=False).json()["code"]
        == "ACKNOWLEDGEMENT_REQUIRED"
    )
    accept_key = str(uuid4())
    assert accept(client, base, proposal, accept_key).status_code == 200
    assert accept(client, base, proposal, accept_key).status_code == 200
    after = client.get(base).json()["data"]
    assert after["current_version_id"] == proposal["candidate_version_id"]
    assert after["draft_version_id"] == trip["draft_version_id"]
    result = client.post(
        base + "/draft/commands",
        headers={"If-Match": tag},
        json={
            "commands": [{"type": "activity.replace_user_schedule", "activities": []}]
        },
    )
    assert result.status_code == 200
    accepted = client.get(base + f"/versions/{after['current_version_id']}").json()[
        "data"
    ]
    assert accepted["status"] == "accepted"
    assert len(accepted["activities"]) == 1
    assert accepted["activities"][0]["fixed"]


def test_stale_draft_cannot_accept_and_discard_preserves_edits(context):
    client, _, _ = context
    base, trip, tag = setup(client)
    proposal = submit(client, base, tag).json()["data"]
    changed = client.post(
        base + "/draft/commands",
        headers={"If-Match": tag},
        json={
            "commands": [{"type": "activity.replace_user_schedule", "activities": []}]
        },
    )
    assert changed.status_code == 200
    assert accept(client, base, proposal).json()["code"] == "STALE_PROPOSAL"
    assert client.post(base + f"/proposals/{proposal['id']}/discard").status_code == 200
    assert client.post(base + f"/proposals/{proposal['id']}/discard").status_code == 200
    assert client.get(base).json()["data"]["current_version_id"] is None
    assert (
        client.get(base + f"/versions/{trip['draft_version_id']}").json()["data"][
            "activities"
        ]
        == []
    )


def test_conflicts_are_previewable_but_never_accepted(context):
    client, _, _ = context
    base, _, tag = setup(client, overlap=True)
    proposal = submit(client, base, tag).json()["data"]
    assert proposal["validation"]["status"] == "conflicted"
    assert accept(client, base, proposal).json()["code"] == "PLAN_CONFLICT"
    assert client.get(base).json()["data"]["current_version_id"] is None


def test_ownership_preconditions_and_competing_proposals(context):
    client, db, _ = context
    base, _, tag = setup(client)
    assert client.post(base + "/draft/submit").status_code == 428
    assert submit(client, base, '"draft:wrong:0"').status_code == 412
    one = submit(client, base, tag).json()["data"]
    two = submit(client, base, tag).json()["data"]
    assert accept(client, base, one).status_code == 200
    assert accept(client, base, two).json()["code"] == "STALE_PROPOSAL"
    assert (
        client.get(f"/api/v1/trips/{uuid4()}/proposals/{one['id']}").status_code == 404
    )
