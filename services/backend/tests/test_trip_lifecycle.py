import pytest
import test_proposals
import test_trips


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def test_start_requires_accepted_plan_and_preserves_draft(context):
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    before = client.get(base)
    response = client.patch(
        base, headers={"If-Match": before.headers["etag"]}, json={"lifecycle": "active"}
    )
    assert response.status_code == 409
    assert response.json()["code"] == "TRIP_ACCEPTED_PLAN_REQUIRED"
    after = client.get(base)
    assert after.headers["etag"] == before.headers["etag"]
    assert after.json()["data"] == before.json()["data"]
    assert after.json()["data"]["draft_version_id"] == trip["draft_version_id"]


def test_start_finish_resume_preserve_snapshots_and_completion(context):
    client, _, _ = context
    base, trip, tag = test_proposals.setup(client)
    proposal = test_proposals.submit(client, base, tag).json()["data"]
    assert test_proposals.accept(client, base, proposal).status_code == 200
    baseline = client.get(base).json()["data"]
    draft_path = base + f"/versions/{trip['draft_version_id']}"
    accepted_path = base + f"/versions/{baseline['current_version_id']}"
    draft = client.get(draft_path).json()["data"]
    accepted = client.get(accepted_path).json()["data"]
    for state in ("active", "completed", "active", "planning"):
        metadata = client.get(base)
        response = client.patch(
            base,
            headers={"If-Match": metadata.headers["etag"]},
            json={"lifecycle": state},
        )
        assert response.status_code == 200, response.text
        row = response.json()["data"]
        assert row["lifecycle"] == state
        assert row["current_version_id"] == baseline["current_version_id"]
        assert row["draft_version_id"] == baseline["draft_version_id"]
        assert client.get(draft_path).json()["data"] == draft
        assert client.get(accepted_path).json()["data"] == accepted


def test_stale_status_and_other_owner_cannot_transition(context):
    client, db, identity = context
    base, _, _ = test_proposals.setup(client)
    before = client.get(base)
    assert (
        client.patch(
            base,
            headers={"If-Match": before.headers["etag"]},
            json={"title": "Newer title"},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            base,
            headers={"If-Match": before.headers["etag"]},
            json={"lifecycle": "completed"},
        ).status_code
        == 412
    )
    assert client.get(base).json()["data"]["lifecycle"] == "planning"
    from app.api.identity import TrustedIdentity, verified_identity
    from app.main import app

    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "test-issuer", "another-owner", "other@example.org", "other@example.org"
    )
    assert (
        client.patch(
            base,
            headers={"If-Match": before.headers["etag"]},
            json={"lifecycle": "completed"},
        ).status_code
        == 404
    )
