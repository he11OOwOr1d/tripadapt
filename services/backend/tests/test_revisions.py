from uuid import uuid4

import pytest
import test_proposals
import test_reschedule
import test_trips

from app.api.identity import TrustedIdentity, verified_identity
from app.main import app
from app.planning.restoration import restoration_report


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def setup(client):
    plan, _ = test_reschedule.sample()
    plan.traveler_count = 2
    plan.room_count = 2
    original = plan.model_dump(mode="json")
    original.update(
        date_mode="duration",
        desired_days=30,
        budget={"amount": "1234.50", "mode": "target"},
        origin={"label": "Delhi", "latitude": None, "longitude": None},
    )
    trip = client.post(
        "/api/v1/trips", json={"title": "Restore check", "plan": original}
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    url = base + f"/versions/{trip['draft_version_id']}"
    tag = client.get(url).headers["etag"]
    first = test_proposals.submit(client, base, tag).json()["data"]
    assert test_proposals.accept(client, base, first).status_code == 200
    changed = {
        **original,
        "traveler_count": 5,
        "room_count": 3,
        "desired_days": 40,
        "budget": {"amount": "9000", "mode": "target"},
        "origin": {"label": "Mumbai", "latitude": None, "longitude": None},
        "preferences": {**original["preferences"], "pace": "fast"},
        "stops": [],
        "activities": [],
    }
    response = client.post(
        base + "/draft/commands",
        headers={"If-Match": tag},
        json={
            "commands": [
                {"type": "plan.update_settings", "changes": changed},
                {"type": "activity.replace_user_schedule", "activities": []},
            ]
        },
    )
    assert response.status_code == 200, response.text
    tag = response.headers["etag"]
    second = test_proposals.submit(client, base, tag).json()["data"]
    assert test_proposals.accept(client, base, second).status_code == 200
    return base, trip, url, tag, first, second


def restore(client, base, version_id, tag, key=None):
    return client.post(
        base + f"/revisions/{version_id}/restore",
        headers={"If-Match": tag, "Idempotency-Key": key or str(uuid4())},
    )


@pytest.mark.parametrize("outcome", ["accept", "discard", "stale"])
def test_full_snapshot_restoration_is_reviewed_and_history_is_immutable(
    context, outcome
):
    client, _, _ = context
    base, trip, url, tag, first, second = setup(client)
    first_url = base + f"/versions/{first['candidate_version_id']}"
    historical = client.get(first_url).json()["data"]
    history = client.get(base + "/revisions?limit=1").json()["data"]
    assert history["revisions"][0]["id"] == second["candidate_version_id"]
    assert history["revisions"][0]["current"]
    older = client.get(base + f"/revisions?before={history['next_before']}").json()[
        "data"
    ]
    assert older["revisions"][0]["id"] == first["candidate_version_id"]
    key = str(uuid4())
    response = restore(client, base, first["candidate_version_id"], tag, key)
    assert response.status_code == 202, response.text
    proposal = response.json()["data"]
    assert response.headers["location"].endswith(proposal["id"])
    assert (
        restore(client, base, first["candidate_version_id"], tag, key).json()["data"][
            "id"
        ]
        == proposal["id"]
    )
    assert (
        restore(client, base, second["candidate_version_id"], tag, key).status_code
        == 409
    )
    assert client.get(url).json()["data"]["traveler_count"] == 5
    assert proposal["plan"]["traveler_count"] == 2
    assert proposal["generation"]["restoration"]["added"] == 2
    if outcome == "discard":
        assert (
            client.post(base + f"/proposals/{proposal['id']}/discard").status_code
            == 200
        )
    elif outcome == "stale":
        assert (
            client.post(
                base + "/draft/commands",
                headers={"If-Match": tag},
                json={
                    "commands": [
                        {"type": "activity.replace_user_schedule", "activities": []}
                    ]
                },
            ).status_code
            == 200
        )
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
        assert accepted.json()["data"]["plan"] == first["plan"]
        assert (
            accepted.json()["data"]["candidate_version_id"]
            != first["candidate_version_id"]
        )
        restored = client.get(url).json()["data"]
        assert restored["traveler_count"] == 2
        assert restored["room_count"] == 2
        assert restored["desired_days"] == 30
        assert restored["origin"]["label"] == "Delhi"
        assert restored["preferences"]["pace"] == "balanced"
        assert restored["budget"]["amount"] == "1234.5000"
        assert len(restored["activities"]) == 2
    assert client.get(first_url).json()["data"] == historical
    assert (
        client.get(base + f"/versions/{second['candidate_version_id']}").json()["data"][
            "traveler_count"
        ]
        == 5
    )


@pytest.mark.parametrize("change", ["remove", "complete", "dates", "timezone"])
def test_restore_cannot_rewind_protected_present_day_items(change):
    current, _ = test_reschedule.sample()
    current.activities[0].fixed = True
    candidate = current.model_copy(deep=True)
    if change == "remove":
        candidate.activities.pop(0)
    if change == "complete":
        candidate.activities[0].completed = True
    if change == "dates":
        candidate.desired_days = 50
    if change == "timezone":
        candidate.stops[0].timezone = "Europe/Paris"
    report = restoration_report(current, candidate)
    assert report["status"] == "conflicted"
    assert any(i["code"] == "RESTORE_PROTECTED" for i in report["issues"])


def test_history_is_owned_and_only_accepted_snapshots_restore(context):
    client, _, _ = context
    base, trip, _, tag, first, _ = setup(client)
    assert restore(client, base, trip["draft_version_id"], tag).status_code == 409
    assert (
        client.post(
            base + f"/revisions/{first['candidate_version_id']}/restore"
        ).status_code
        == 428
    )
    assert (
        restore(client, base, first["candidate_version_id"], '"wrong"').status_code
        == 412
    )
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "other", str(uuid4()), "other@example.org", "other@example.org"
    )
    assert client.get(base + "/revisions").status_code == 404
    assert restore(client, base, first["candidate_version_id"], tag).status_code == 404


def test_drafts_do_not_appear_as_accepted_history(context):
    client, _, _ = context
    trip = client.post("/api/v1/trips", json={"title": "Not accepted yet"}).json()[
        "data"
    ]
    assert client.get(f"/api/v1/trips/{trip['id']}/revisions").json()["data"] == {
        "revisions": [],
        "next_before": None,
    }


def test_protected_current_draft_blocks_restore_at_acceptance(context):
    client, _, _ = context
    base, _, _, tag, first, _ = setup(client)
    protected = {**first["plan"]["activities"][0], "completed": True}
    changed = client.post(
        base + "/draft/commands",
        headers={"If-Match": tag},
        json={
            "commands": [
                {"type": "activity.replace_user_schedule", "activities": [protected]}
            ]
        },
    )
    assert changed.status_code == 200
    response = restore(
        client, base, first["candidate_version_id"], changed.headers["etag"]
    )
    assert response.status_code == 202
    proposal = response.json()["data"]
    assert any(
        i["code"] == "RESTORE_PROTECTED" for i in proposal["validation"]["issues"]
    )
    assert (
        test_proposals.accept(client, base, proposal).json()["code"] == "PLAN_CONFLICT"
    )
