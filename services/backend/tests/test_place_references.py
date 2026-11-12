from uuid import UUID, uuid4

import pytest
import test_proposals
import test_revisions
import test_trips
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_geocoding import item

from app.api import destinations
from app.api.proposals import plan_input
from app.config import settings
from app.persistence.models import PlanVersion
from app.providers.geocoding import Geocoder


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def selected(client, monkeypatch):
    monkeypatch.setattr(settings, "place_search_enabled", True)
    monkeypatch.setattr(
        destinations, "geocoder", Geocoder(lambda q: {"results": [item()]})
    )
    first = client.get("/api/v1/destinations/search?q=Kyoto").json()["data"]
    again = client.get("/api/v1/destinations/search?q=Kyoto").json()["data"]
    assert again["cached"]
    assert first["results"] == again["results"]
    return first["results"][0]


def test_reference_survives_save_commands_proposal_and_accepted_snapshot(
    context, monkeypatch
):
    client, db, _ = context
    place = selected(client, monkeypatch)
    stop = dict(
        client_id=str(uuid4()),
        name=place["label"],
        timezone=place["timezone"],
        desired_nights=3,
        place_reference_id=place["reference_id"],
    )
    response = client.post(
        "/api/v1/trips", json={"title": "Referenced route", "plan": {"stops": [stop]}}
    )
    assert response.status_code == 201, response.text
    trip = response.json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    version = f"{base}/versions/{trip['draft_version_id']}"
    assert client.get(version + "/stops").json()["data"][0]["place_reference"] == place
    tag = client.get(version).headers["etag"]
    changed = client.post(
        base + "/draft/commands",
        headers={"If-Match": tag},
        json={
            "commands": [{"type": "activity.replace_user_schedule", "activities": []}]
        },
    )
    assert changed.status_code == 200, changed.text
    tag = client.get(version).headers["etag"]
    proposal = test_proposals.submit(client, base, tag).json()["data"]
    assert proposal["plan"]["stops"][0]["place_reference_id"] == place["reference_id"]
    assert proposal["location_references"][place["reference_id"]] == place
    accepted = test_proposals.accept(client, base, proposal)
    assert accepted.status_code == 200, accepted.text
    snapshot = db.get(PlanVersion, UUID(proposal["candidate_version_id"]))
    assert (
        str(plan_input(db, snapshot).stops[0].place_reference_id)
        == place["reference_id"]
    )
    snapshot_id = str(snapshot.id)
    db.commit()
    assert (
        client.get(f"{base}/versions/{snapshot_id}/stops").json()["data"][0][
            "place_reference"
        ]
        == place
    )
    changed = client.post(
        base + "/draft/commands",
        headers={"If-Match": tag},
        json={
            "commands": [
                {
                    "type": "stop.reorder",
                    "stops": [{**stop, "place_reference_id": None}],
                    "cascade": True,
                }
            ]
        },
    )
    assert changed.status_code == 200, changed.text
    tag = changed.headers["etag"]
    manual = test_proposals.submit(client, base, tag).json()["data"]
    assert test_proposals.accept(client, base, manual).status_code == 200
    restored = test_revisions.restore(client, base, snapshot_id, tag)
    assert restored.status_code == 202, restored.text
    proposal = restored.json()["data"]
    assert proposal["location_references"][place["reference_id"]] == place
    assert test_proposals.accept(client, base, proposal).status_code == 200
    assert client.get(version + "/stops").json()["data"][0]["place_reference"] == place


@pytest.mark.parametrize(
    "change",
    [
        {"name": "Different"},
        {"timezone": "Europe/Paris"},
        {"place_reference_id": str(uuid4())},
    ],
)
def test_reference_cannot_be_attached_to_a_different_place(
    context, monkeypatch, change
):
    client, _, _ = context
    place = selected(client, monkeypatch)
    stop = {
        "name": place["label"],
        "timezone": place["timezone"],
        "place_reference_id": place["reference_id"],
        **change,
    }
    response = client.post(
        "/api/v1/trips", json={"title": "Mismatch", "plan": {"stops": [stop]}}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "DESTINATION_REFERENCE_MISMATCH"


def test_browser_coordinates_are_not_trusted_and_manual_stops_still_work(context):
    client, _, _ = context
    stop = {"name": "My place", "timezone": "Asia/Tokyo"}
    rejected = client.post(
        "/api/v1/trips",
        json={"title": "Manual", "plan": {"stops": [{**stop, "latitude": 35}]}},
    )
    assert rejected.status_code == 422
    saved = client.post(
        "/api/v1/trips", json={"title": "Manual", "plan": {"stops": [stop]}}
    )
    assert saved.status_code == 201, saved.text
    trip = saved.json()["data"]
    stops = client.get(
        f"/api/v1/trips/{trip['id']}/versions/{trip['draft_version_id']}/stops"
    ).json()["data"]
    assert stops[0]["place_reference"] is None


def test_provider_snapshots_cannot_be_updated_or_deleted(context, monkeypatch):
    client, db, _ = context
    place = selected(client, monkeypatch)
    for statement in [
        "UPDATE place_reference SET provider_place_id=1 WHERE id=:id",
        "DELETE FROM place_reference WHERE id=:id",
    ]:
        with pytest.raises(DBAPIError):
            with db.begin_nested():
                db.execute(text(statement), {"id": place["reference_id"]})
