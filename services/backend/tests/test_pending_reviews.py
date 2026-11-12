from uuid import UUID, uuid4

import pytest
import test_time_change_proposals as moves
import test_trips

from app.api.identity import TrustedIdentity, verified_identity
from app.main import app
from app.persistence.models import PlanVersion


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def test_empty_pending_list_and_pagination(context):
    client, _, _ = context
    base, _, tag, body = moves.setup(client)
    assert client.get(base + "/proposals").json()["data"] == {
        "reviews": [],
        "next_before": None,
    }
    ids = []
    for start in ["11:40", "11:45", "11:50"]:
        ids.append(
            moves.propose(
                client, base, tag, {**body, "local_start_time": start}
            ).json()["data"]["id"]
        )
    first = client.get(base + "/proposals?limit=2")
    assert first.headers["cache-control"] == "private, no-store"
    page = first.json()["data"]
    assert [r["id"] for r in page["reviews"]] == list(reversed(ids))[0:2]
    assert all(not row["stale"] for row in page["reviews"])
    assert (
        page["reviews"][0]["title"] == "Museum"
        and "11:50" in page["reviews"][0]["summary"]
    )
    second = client.get(
        base + f"/proposals?limit=2&before={page['next_before']}"
    ).json()["data"]
    assert [r["id"] for r in second["reviews"]] == [ids[0]] and second[
        "next_before"
    ] is None
    assert client.get(base + "/proposals?limit=51").status_code == 422
    assert client.get(base + "/proposals?before=0").status_code == 422


def test_accepted_and_discarded_reviews_leave_the_pending_list(context):
    client, _, _ = context
    base, _, tag, body = moves.setup(client)
    first = moves.propose(client, base, tag, body).json()["data"]
    second = moves.propose(
        client, base, tag, {**body, "local_start_time": "11:45"}
    ).json()["data"]
    assert client.post(base + f"/proposals/{first['id']}/discard").status_code == 200
    assert [
        r["id"] for r in client.get(base + "/proposals").json()["data"]["reviews"]
    ] == [second["id"]]
    assert moves.accept(client, base, second).status_code == 200
    assert client.get(base + "/proposals").json()["data"]["reviews"] == []


def test_draft_changes_mark_list_and_resumed_view_stale(context):
    client, db, _ = context
    base, trip, tag, body = moves.setup(client)
    proposed = moves.propose(client, base, tag, body).json()["data"]
    assert proposed["stale"] is False
    draft = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    draft.edit_sequence += 1
    db.commit()
    assert client.get(base + "/proposals").json()["data"]["reviews"][0]["stale"] is True
    view = client.get(base + f"/proposals/{proposed['id']}").json()["data"]
    assert view["stale"] is True and view["generation"]["change"]["after"] == "11:40"
    assert moves.accept(client, base, view).status_code == 409


def test_another_acceptance_makes_other_pending_reviews_stale(context):
    client, _, _ = context
    base, _, tag, body = moves.setup(client)
    first = moves.propose(client, base, tag, body).json()["data"]
    second = moves.propose(
        client, base, tag, {**body, "local_start_time": "11:45"}
    ).json()["data"]
    assert moves.accept(client, base, first).status_code == 200
    page = client.get(base + "/proposals").json()["data"]
    assert (
        len(page["reviews"]) == 1
        and page["reviews"][0]["id"] == second["id"]
        and page["reviews"][0]["stale"]
    )


def test_pending_list_is_private_to_owner(context):
    client, _, _ = context
    base, _, tag, body = moves.setup(client)
    moves.propose(client, base, tag, body)
    other = TrustedIdentity(
        "test-issuer", str(uuid4()), "other@example.org", "other@example.org"
    )
    app.dependency_overrides[verified_identity] = lambda: other
    assert client.get(base + "/proposals").status_code == 404
    app.dependency_overrides.pop(verified_identity)
    assert client.get(base + "/proposals").status_code == 401
