from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import pytest
import test_place_references
import test_time_change_proposals
import test_trips
from sqlalchemy import select

from app.api import weather
from app.api.identity import TrustedIdentity, verified_identity
from app.main import app
from app.persistence.models import Activity, PlanVersion, Trip
from app.providers.weather import Forecast, WeatherDay, WeatherFailure


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def setup(client, monkeypatch, protection=None, exact=False):
    reference = test_place_references.selected(client, monkeypatch)
    today = datetime.now(ZoneInfo(reference["timezone"])).date()
    calls = []
    state = SimpleNamespace(age=0, failure=None, covered=True)

    def forecast(*args):
        calls.append(args)
        if state.failure:
            raise state.failure
        return Forecast(
            days=[
                WeatherDay(
                    date=today if state.covered else today + timedelta(days=1),
                    weather_code=61,
                    temperature_min_c=10,
                    temperature_max_c=20,
                    precipitation_mm=3,
                    precipitation_probability_percent=70,
                )
            ],
            retrieved_at=datetime.now(timezone.utc) - timedelta(seconds=state.age),
        )

    monkeypatch.setattr(weather, "weather_provider", SimpleNamespace(forecast=forecast))
    stop, target, other = str(uuid4()), str(uuid4()), str(uuid4())
    plan = dict(
        stops=[
            dict(
                client_id=stop,
                name=reference["label"],
                timezone=reference["timezone"],
                desired_nights=12,
                place_reference_id=reference["reference_id"],
            )
        ],
        activities=[
            dict(
                logical_id=target,
                stop_logical_id=stop,
                user_label="Walk",
                local_day_offset=0,
                local_start_time="10:00",
                duration_minutes=60,
                **(protection or {}),
            ),
            dict(
                logical_id=other,
                stop_logical_id=stop,
                user_label="Commitment",
                local_day_offset=0,
                local_start_time="13:00",
                duration_minutes=60,
                fixed=True,
            ),
        ],
    )
    if exact:
        plan.update(date_mode="exact", start_date=today.isoformat())
    response = client.post(
        "/api/v1/trips", json=dict(title="Weather revision QA", plan=plan)
    )
    assert response.status_code == 201, response.text
    trip = response.json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    version = base + f"/versions/{trip['draft_version_id']}"
    tag = client.get(version).headers["etag"]
    body = dict(
        activity_id=target, visit_date=today.isoformat(), intent="leave_time_open"
    )
    return base, version, trip, tag, body, calls, state


def propose(client, base, tag, body, key=None):
    return client.post(
        base + "/proposals/weather-change",
        json=body,
        headers={"If-Match": tag, "Idempotency-Key": key or str(uuid4())},
    )


def test_server_forecast_frozen_until_accept_and_retry_idempotent(context, monkeypatch):
    client, _, _ = context
    base, version, trip, tag, body, calls, _ = setup(client, monkeypatch)
    original = client.get(version).json()["data"]
    key = str(uuid4())
    response = propose(client, base, tag, body, key)
    assert response.status_code == 201, response.text
    proposal = response.json()["data"]
    assert proposal["source"] == "user"
    assert proposal["generation"]["weather"]["date_basis"] == "check_only"
    assert proposal["generation"]["weather"]["day"]["precipitation_mm"] == 3
    assert len(calls) == 1
    assert client.get(version).json()["data"] == original
    assert propose(client, base, tag, body, key).json()["data"]["id"] == proposal["id"]
    assert len(calls) == 1
    changed = {
        **body,
        "visit_date": (datetime.fromisoformat(body["visit_date"]) + timedelta(days=1))
        .date()
        .isoformat(),
    }
    assert propose(client, base, tag, changed, key).status_code == 409
    assert (
        client.post(
            base + "/draft/submit", headers={"If-Match": tag, "Idempotency-Key": key}
        ).status_code
        == 409
    )
    pending = client.get(base + "/proposals").json()["data"]["reviews"]
    assert pending[0]["title"] == "Leave time open: Walk"
    ack_key = str(uuid4())
    accepted = test_time_change_proposals.accept(client, base, proposal, ack_key)
    assert accepted.status_code == 200, accepted.text
    assert (
        test_time_change_proposals.accept(client, base, proposal, ack_key).status_code
        == 200
    )
    current = client.get(version).json()["data"]
    assert current["activities"] == [
        a for a in original["activities"] if a["logical_id"] != body["activity_id"]
    ]
    assert current["stops"] == original["stops"]
    assert (
        client.get(base).json()["data"]["current_version_id"]
        == proposal["candidate_version_id"]
    )
    assert client.get(base + "/revisions").json()["data"]["revisions"]


@pytest.mark.parametrize("field", ["fixed", "booked", "completed"])
def test_protected_items_rejected_before_provider(context, monkeypatch, field):
    client, _, _ = context
    base, _, _, tag, body, calls, _ = setup(client, monkeypatch, {field: True})
    assert propose(client, base, tag, body).status_code == 409
    assert not calls


def test_exact_schedule_date_binding_and_no_forged_provider_context(
    context, monkeypatch
):
    client, _, _ = context
    base, _, _, tag, body, calls, _ = setup(client, monkeypatch, exact=True)
    wrong = {**body, "visit_date": "2099-01-01"}
    response = propose(client, base, tag, wrong)
    assert (
        response.status_code == 409
        and response.json()["code"] == "WEATHER_DATE_MISMATCH"
    )
    assert not calls
    assert (
        propose(client, base, tag, {**body, "weather": {"weather_code": 0}}).status_code
        == 422
    )
    response = propose(client, base, tag, body)
    assert response.status_code == 201, response.text
    assert (
        response.json()["data"]["generation"]["weather"]["date_basis"]
        == "trip_schedule"
    )


@pytest.mark.parametrize(
    "failure", ["outage", "quota", "missing", "distant", "expired", "future"]
)
def test_unknown_or_stale_forecast_never_creates_proposal(
    context, monkeypatch, failure
):
    (
        client,
        _,
        _,
    ) = context
    base, version, _, tag, body, _, state = setup(client, monkeypatch)
    original = client.get(version).json()["data"]
    if failure == "outage":
        state.failure = WeatherFailure()
    if failure == "quota":
        state.failure = WeatherFailure("WEATHER_RATE_LIMITED", 429)
    if failure == "missing":
        state.covered = False
    if failure == "distant":
        body["visit_date"] = "2099-01-01"
    if failure == "expired":
        state.age = 901
    if failure == "future":
        state.age = -60
    response = propose(client, base, tag, body)
    assert response.status_code == (
        503 if failure == "outage" else 429 if failure == "quota" else 409
    ), response.text
    if failure == "quota":
        assert response.headers["retry-after"] == "60"
    assert client.get(base + "/proposals").json()["data"]["reviews"] == []
    assert client.get(version).json()["data"] == original


@pytest.mark.parametrize("change", ["candidate", "expiry", "scope", "stale", "active"])
def test_acceptance_revalidates_shape_scope_freshness_and_lifecycle(
    context, monkeypatch, change
):
    client, db, _ = context
    base, version, trip, tag, body, _, _ = setup(client, monkeypatch)
    proposal = propose(client, base, tag, body).json()["data"]
    snapshot = db.get(PlanVersion, UUID(proposal["candidate_version_id"]))
    if change == "candidate":
        item = db.scalar(select(Activity).where(Activity.version_id == snapshot.id))
        item.duration_minutes += 10
    elif change in ("expiry", "scope"):
        import copy

        report = copy.deepcopy(snapshot.validation_report)
        if change == "expiry":
            report["weather_revision"]["weather"]["retrieved_at"] = (
                datetime.now(timezone.utc) - timedelta(minutes=16)
            ).isoformat()
        else:
            report["weather_revision"]["scope"]["local_day_offset"] = 1
        snapshot.validation_report = report
    elif change == "stale":
        db.get(PlanVersion, UUID(trip["draft_version_id"])).edit_sequence += 1
    else:
        db.get(Trip, UUID(trip["id"])).lifecycle = "active"
    db.commit()
    response = test_time_change_proposals.accept(client, base, proposal)
    assert response.status_code == 409, response.text
    assert len(client.get(version).json()["data"]["activities"]) == 2
    assert (
        client.get(base + f"/proposals/{proposal['id']}").json()["data"]["status"]
        == "pending"
    )


def test_preconditions_ownership_discard_and_missing_location(context, monkeypatch):
    client, db, _ = context
    base, version, trip, tag, body, calls, _ = setup(client, monkeypatch)
    assert client.post(base + "/proposals/weather-change", json=body).status_code == 428
    assert propose(client, base, '"old"', body).status_code == 412
    assert (
        propose(client, base, tag, {**body, "activity_id": str(uuid4())}).status_code
        == 404
    )
    proposal = propose(client, base, tag, body).json()["data"]
    assert client.post(base + f"/proposals/{proposal['id']}/discard").status_code == 200
    assert len(client.get(version).json()["data"]["activities"]) == 2
    assert test_time_change_proposals.accept(client, base, proposal).status_code == 409
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "test-issuer", str(uuid4()), "other@example.org", "other@example.org"
    )
    assert propose(client, base, tag, body).status_code == 404
    app.dependency_overrides.pop(verified_identity)
    assert propose(client, base, tag, body).status_code == 401


def test_no_location_or_active_trip_is_rejected_without_lookup(context, monkeypatch):
    from app.persistence.models import DestinationStop

    client, db, _ = context
    base, _, trip, tag, body, calls, _ = setup(client, monkeypatch)
    row = db.get(Trip, UUID(trip["id"]))
    row.lifecycle = "active"
    db.commit()
    response = propose(client, base, tag, body)
    assert (
        response.status_code == 409
        and response.json()["code"] == "WEATHER_PLANNING_ONLY"
    )
    row.lifecycle = "planning"
    stop = db.scalar(
        select(DestinationStop).where(
            DestinationStop.version_id == UUID(trip["draft_version_id"])
        )
    )
    stop.place_reference_id = None
    db.commit()
    response = propose(client, base, tag, body)
    assert (
        response.status_code == 409
        and response.json()["code"] == "WEATHER_LOCATION_REQUIRED"
    )
    assert not calls


def test_forecast_warning_requires_explicit_acknowledgement(context, monkeypatch):
    client, _, _ = context
    base, version, _, tag, body, _, _ = setup(client, monkeypatch)
    proposal = propose(client, base, tag, body).json()["data"]
    response = client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "expected_current_version_id": proposal["base_current_version_id"],
            "acknowledged_issue_ids": [],
        },
    )
    assert (
        response.status_code == 409
        and response.json()["code"] == "ACKNOWLEDGEMENT_REQUIRED"
    )
    assert len(client.get(version).json()["data"]["activities"]) == 2
