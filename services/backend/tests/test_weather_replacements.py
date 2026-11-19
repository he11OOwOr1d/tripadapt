from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
import test_time_change_proposals
import test_trips
import test_weather_revisions as weather_tests
from fastapi import HTTPException
from sqlalchemy import select

from app.api import proposals
from app.persistence.models import Activity, DiscoveredPlace, PlanVersion


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def setup(client, db, monkeypatch, **kwargs):
    db.expire_on_commit = False
    result = weather_tests.setup(client, monkeypatch, **kwargs)
    base, version, trip, tag, body, calls, state = result
    plan = proposals.plan_input(db, db.get(PlanVersion, UUID(trip["draft_version_id"])))
    place = DiscoveredPlace(
        id=uuid4(),
        destination_reference_id=plan.stops[0].place_reference_id,
        payload=dict(
            external_id="node/999",
            name="Gallery alternative",
            category="gallery",
            latitude=35.02,
            longitude=135.75,
            source="OpenStreetMap contributors via Overpass",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
        ),
    )
    db.add(place)
    db.flush()
    db.commit()
    body.update(intent="replace_place", replacement_place_id=str(place.id))
    return result, place


def test_replacement_is_frozen_then_changes_only_one_place(context, monkeypatch):
    client, db, _ = context
    (base, version, trip, tag, body, _, _), place = setup(client, db, monkeypatch)
    target = db.scalar(
        select(Activity).where(
            Activity.version_id == UUID(trip["draft_version_id"]),
            Activity.logical_item_id == UUID(body["activity_id"]),
        )
    )
    target.google_place_id = "old_listing"
    db.commit()
    original = client.get(version).json()["data"]
    key = str(uuid4())
    response = weather_tests.propose(client, base, tag, body, key)
    assert response.status_code == 201, response.text
    proposal = response.json()["data"]
    assert proposal["generation"]["operation"] == "replace_activity"
    assert proposal["generation"]["replacement"]["before"] == "Walk"
    assert proposal["generation"]["provisional_date"] == body["visit_date"]
    assert str(place.id) in proposal["place_details"]
    assert client.get(version).json()["data"] == original
    assert (
        weather_tests.propose(client, base, tag, body, key).json()["data"]["id"]
        == proposal["id"]
    )
    assert (
        weather_tests.propose(
            client,
            base,
            tag,
            {**body, "intent": "leave_time_open", "replacement_place_id": None},
            key,
        ).status_code
        == 409
    )
    accepted = test_time_change_proposals.accept(client, base, proposal)
    assert accepted.status_code == 200, accepted.text
    current = client.get(version).json()["data"]
    expected = original["activities"]
    item = next(a for a in expected if a["logical_id"] == body["activity_id"])
    item.update(
        user_label="Gallery alternative",
        place_id=str(place.id),
        google_place_id=None,
        kind="custom",
    )
    assert sorted(current["activities"], key=lambda a: a["logical_id"]) == sorted(
        expected, key=lambda a: a["logical_id"]
    )
    assert current["stops"] == original["stops"]


@pytest.mark.parametrize("change", ["foreign", "category", "expired", "missing"])
def test_replacement_requires_recent_same_destination_museum_or_gallery(
    context, monkeypatch, change
):
    client, db, _ = context
    (base, _, _, tag, body, calls, _), place = setup(client, db, monkeypatch)
    if change == "foreign":
        body["replacement_place_id"] = str(uuid4())
    elif change == "missing":
        body.pop("replacement_place_id")
    else:
        payload = dict(place.payload)
        if change == "category":
            payload["category"] = "park"
        else:
            payload["retrieved_at"] = (
                datetime.now(timezone.utc) - timedelta(hours=25)
            ).isoformat()
        alternative = DiscoveredPlace(
            id=uuid4(),
            destination_reference_id=place.destination_reference_id,
            payload=payload,
        )
        db.add(alternative)
        body["replacement_place_id"] = str(alternative.id)
        db.commit()
    response = weather_tests.propose(client, base, tag, body)
    assert response.status_code == (422 if change == "missing" else 409), response.text
    assert not calls
    assert client.get(base + "/proposals").json()["data"]["reviews"] == []


@pytest.mark.parametrize("field", ["fixed", "booked", "completed"])
def test_replacement_protects_commitments(context, monkeypatch, field):
    client, db, _ = context
    (base, _, _, tag, body, calls, _), _ = setup(
        client, db, monkeypatch, protection={field: True}
    )
    assert weather_tests.propose(client, base, tag, body).status_code == 409
    assert not calls


def test_acceptance_rejects_extra_candidate_changes(context, monkeypatch):
    client, db, _ = context
    (base, _, _, tag, body, _, _), _ = setup(client, db, monkeypatch)
    proposal = weather_tests.propose(client, base, tag, body).json()["data"]
    item = db.scalar(
        select(Activity).where(
            Activity.version_id == UUID(proposal["candidate_version_id"])
        )
    )
    item.duration_minutes += 5
    db.commit()
    assert test_time_change_proposals.accept(client, base, proposal).status_code == 409


def test_live_checks_are_explicit_date_bound_and_fail_closed(context, monkeypatch):
    client, db, _ = context
    (base, version, _, tag, body, _, _), _ = setup(client, db, monkeypatch)
    proposal = weather_tests.propose(client, base, tag, body).json()["data"]
    calls = []

    def check(*args):
        calls.append(args)
        raise HTTPException(409, "LIVE_CHECK_ROUTE_SHORTFALL")

    monkeypatch.setattr(proposals, "recheck_move", check)
    request = dict(
        expected_current_version_id=proposal["base_current_version_id"],
        acknowledged_issue_ids=[
            i["id"] for i in proposal["validation"]["issues"] if i["acknowledgeable"]
        ],
        live_check=dict(
            google_place_id="listing",
            visit_date=body["visit_date"],
            mode="WALK",
            buffer_minutes=10,
        ),
    )
    url = base + f"/proposals/{proposal['id']}/accept"
    response = client.post(url, headers={"Idempotency-Key": str(uuid4())}, json=request)
    assert (
        response.status_code == 409
        and response.json()["code"] == "LIVE_CHECK_ROUTE_SHORTFALL"
    )
    assert len(calls) == 1
    assert calls[0][4]["command"]["activity_id"] == body["activity_id"]
    assert (
        next(
            a
            for a in client.get(version).json()["data"]["activities"]
            if a["logical_id"] == body["activity_id"]
        )["user_label"]
        == "Walk"
    )
    request["live_check"]["visit_date"] = "2099-01-01"
    assert (
        client.post(
            url, headers={"Idempotency-Key": str(uuid4())}, json=request
        ).status_code
        == 422
    )
    assert len(calls) == 1
    assert test_time_change_proposals.accept(client, base, proposal).status_code == 200


def test_foreign_destination_record_and_same_place_are_rejected(context, monkeypatch):
    from app.persistence.models import PlaceReference

    client, db, _ = context
    (base, _, trip, tag, body, calls, _), place = setup(client, db, monkeypatch)
    original = db.get(PlaceReference, place.destination_reference_id)
    foreign = PlaceReference(
        id=uuid4(),
        provider=original.provider,
        provider_place_id=123456789,
        payload=dict(original.payload),
    )
    db.add(foreign)
    db.flush()
    other = DiscoveredPlace(
        id=uuid4(), destination_reference_id=foreign.id, payload=dict(place.payload)
    )
    db.add(other)
    db.commit()
    response = weather_tests.propose(
        client, base, tag, {**body, "replacement_place_id": str(other.id)}
    )
    assert (
        response.status_code == 409
        and response.json()["code"] == "WEATHER_REPLACEMENT_LOCATION"
    )
    target = db.scalar(
        select(Activity).where(
            Activity.version_id == UUID(trip["draft_version_id"]),
            Activity.logical_item_id == UUID(body["activity_id"]),
        )
    )
    target.place_id = place.id
    db.commit()
    response = weather_tests.propose(client, base, tag, body)
    assert (
        response.status_code == 409
        and response.json()["code"] == "WEATHER_REPLACEMENT_UNCHANGED"
    )
    assert not calls
