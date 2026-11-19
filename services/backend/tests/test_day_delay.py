from uuid import UUID, uuid4

import pytest
import test_trips
from sqlalchemy import select

from app.persistence.models import Activity, PlanVersion
from app.planning.day_delay import DayDelayInput, DelayConflict, delay_day
from app.trips.schemas import PlanInput


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def fixture():
    stop = str(uuid4())
    other = str(uuid4())
    ids = [str(uuid4()) for _ in range(4)]
    value = {
        "stops": [
            {
                "client_id": stop,
                "name": "Jaipur",
                "timezone": "Asia/Kolkata",
                "desired_nights": 20,
            },
            {
                "client_id": other,
                "name": "Udaipur",
                "timezone": "Asia/Kolkata",
                "desired_nights": 2,
            },
        ],
        "activities": [
            {
                "logical_id": ident,
                "stop_logical_id": stop if i < 3 else other,
                "local_day_offset": 12 if i < 3 else 0,
                "local_start_time": start,
                "duration_minutes": 60,
                "user_label": label,
                "completed": i == 0,
            }
            for i, (ident, start, label) in enumerate(
                zip(
                    ids,
                    ["08:00", "10:00", "11:15", "10:00"],
                    ["Done", "Museum", "Lunch", "Other city"],
                )
            )
        ],
    }
    command = {"activity_id": ids[1], "ready_time": "10:30", "at_start_location": True}
    return value, command


def test_delay_shifts_only_suffix_and_preserves_gaps_durations_completed_and_other_stops():
    raw, command = fixture()
    base = PlanInput.model_validate(raw)
    before = base.model_dump()
    result, metadata = delay_day(base, DayDelayInput.model_validate(command))
    assert base.model_dump() == before
    assert [a.local_start_time.strftime("%H:%M") for a in result.activities] == [
        "08:00",
        "10:30",
        "11:45",
        "10:00",
    ]
    assert all(a.duration_minutes == 60 for a in result.activities)
    assert metadata["day"] == 13 and len(metadata["changes"]) == 2


@pytest.mark.parametrize("flag", ["fixed", "booked", "completed"])
def test_delay_explains_protected_anchor_without_partial_changes(flag):
    raw, command = fixture()
    raw["activities"][2][flag] = True
    base = PlanInput.model_validate(raw)
    before = base.model_dump()
    with pytest.raises(DelayConflict) as error:
        delay_day(base, DayDelayInput.model_validate(command))
    assert error.value.code == "DELAY_LOCK_CONFLICT" and "Lunch" in error.value.detail
    assert base.model_dump() == before


def test_completed_start_no_delay_and_midnight_are_rejected():
    raw, command = fixture()
    base = PlanInput.model_validate(raw)
    for change, code in [
        ({"activity_id": str(base.activities[0].logical_id)}, "DELAY_COMPLETED_START"),
        ({"ready_time": "09:00"}, "DELAY_NO_CHANGE"),
        ({"ready_time": "23:30"}, "DELAY_MIDNIGHT"),
    ]:
        with pytest.raises(DelayConflict) as error:
            delay_day(base, DayDelayInput.model_validate({**command, **change}))
        assert error.value.code == code


def create(client):
    value, command = fixture()
    trip = client.post(
        "/api/v1/trips", json={"title": "Delay QA", "plan": value}
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    tag = client.get(base + f"/versions/{trip['draft_version_id']}").headers["etag"]
    return base, trip, tag, command


def propose(client, base, tag, command, key=None):
    return client.post(
        base + "/proposals/day-delay",
        headers={"If-Match": tag, "Idempotency-Key": key or str(uuid4())},
        json=command,
    )


def accept(client, base, proposal):
    return client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "expected_current_version_id": proposal["base_current_version_id"],
            "acknowledged_issue_ids": [
                i["id"]
                for i in proposal["validation"]["issues"]
                if i["acknowledgeable"]
            ],
        },
    )


def test_frozen_delay_is_idempotent_and_applied_only_after_acceptance(context):
    client, _, _ = context
    base, trip, tag, command = create(client)
    key = str(uuid4())
    first = propose(client, base, tag, command, key)
    assert first.status_code == 201, first.text
    proposal = first.json()["data"]
    assert proposal["generation"]["operation"] == "delay_day"
    assert (
        propose(client, base, tag, command, key).json()["data"]["id"] == proposal["id"]
    )
    assert (
        propose(client, base, tag, {**command, "ready_time": "10:45"}, key).status_code
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
        next(
            a for a in draft["activities"] if a["logical_id"] == command["activity_id"]
        )["local_start_time"]
        == "10:00:00"
    )
    listing = client.get(base + "/proposals").json()["data"]["reviews"]
    assert listing[0]["title"] == "Delay adjustment in Jaipur"
    assert accept(client, base, proposal).status_code == 200
    draft = client.get(base + f"/versions/{trip['draft_version_id']}").json()["data"]
    assert (
        next(
            a for a in draft["activities"] if a["logical_id"] == command["activity_id"]
        )["local_start_time"]
        == "10:30:00"
    )


def test_delay_preconditions_and_explicit_location_confirmation(context):
    client, _, _ = context
    base, _, tag, command = create(client)
    assert client.post(base + "/proposals/day-delay", json=command).status_code == 428
    assert propose(client, base, '"stale"', command).status_code == 412
    assert (
        propose(client, base, tag, {**command, "at_start_location": False}).status_code
        == 422
    )
    assert (
        propose(client, base, tag, {**command, "ready_time": "24:00"}).status_code
        == 422
    )


def test_stale_or_tampered_delay_proposal_cannot_be_accepted(context):
    client, db, _ = context
    base, trip, tag, command = create(client)
    proposal = propose(client, base, tag, command).json()["data"]
    row = db.scalar(
        select(Activity).where(
            Activity.version_id == UUID(proposal["candidate_version_id"])
        )
    )
    row.duration_minutes += 5
    db.commit()
    assert accept(client, base, proposal).status_code == 409
    draft = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    draft.edit_sequence += 1
    db.commit()
    assert accept(client, base, proposal).json()["code"] == "STALE_PROPOSAL"


def test_delay_discard_keeps_saved_draft_unchanged(context):
    client, _, _ = context
    base, trip, tag, command = create(client)
    proposal = propose(client, base, tag, command).json()["data"]
    assert client.post(base + f"/proposals/{proposal['id']}/discard").status_code == 200
    draft = client.get(base + f"/versions/{trip['draft_version_id']}").json()["data"]
    assert (
        next(
            a for a in draft["activities"] if a["logical_id"] == command["activity_id"]
        )["local_start_time"]
        == "10:00:00"
    )


def test_delay_endpoint_is_owner_scoped(context):
    from app.api.identity import TrustedIdentity, verified_identity
    from app.main import app

    client, _, _ = context
    base, _, tag, command = create(client)
    other = TrustedIdentity(
        "test-issuer", str(uuid4()), "other@example.org", "other@example.org"
    )
    app.dependency_overrides[verified_identity] = lambda: other
    assert propose(client, base, tag, command).status_code == 404
    app.dependency_overrides.pop(verified_identity)
    assert propose(client, base, tag, command).status_code == 401
