from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
import test_time_change_proposals as moves
import test_trips
from fastapi import HTTPException

from app.api import google_places, journeys, proposals
from app.planning.live_acceptance import (
    LiveAcceptance,
    planned_visit_date,
    recheck_move,
)
from app.trips.schemas import PlanInput


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def plan():
    stop = str(uuid4())
    ids = [str(uuid4()) for _ in range(3)]
    value = PlanInput.model_validate(
        {
            "stops": [
                {
                    "client_id": stop,
                    "name": "Jaipur",
                    "timezone": "Asia/Kolkata",
                    "desired_nights": 20,
                }
            ],
            "activities": [
                {
                    "logical_id": ident,
                    "stop_logical_id": stop,
                    "user_label": str(i),
                    "local_start_time": start,
                    "local_day_offset": 0,
                    "duration_minutes": 60,
                    "place_id": str(uuid4()),
                }
                for i, (ident, start) in enumerate(
                    zip(ids, ["10:00", "11:40", "14:00"])
                )
            ],
        }
    )
    metadata = {
        "command": {"activity_id": ids[1]},
        "scope": {"stop_logical_id": stop, "local_day_offset": 0},
    }
    return value, metadata


def checks(**kw):
    return LiveAcceptance(
        google_place_id="ChIJ_test", visit_date=date(2026, 11, 12), **kw
    )


def providers(monkeypatch, status="fits_reported_hours", spare=5, warnings=None):
    calls = []

    def hours(body, *args):
        calls.append(("hours", body))
        return {"data": SimpleNamespace(status=status)}

    def route(body, *args):
        calls.append(("route", body))
        return {"data": SimpleNamespace(spare_minutes=spare, warnings=warnings or [])}

    monkeypatch.setattr(google_places, "google_check", hours)
    monkeypatch.setattr(journeys, "check_journey", route)
    return calls


def test_both_adjacent_legs_use_candidate_time_and_never_change_plan(monkeypatch):
    value, metadata = plan()
    before = value.model_dump()
    calls = providers(monkeypatch)
    recheck_move(None, None, None, value, metadata, checks())
    assert len(calls) == 3
    assert calls[0][1].start.strftime("%H:%M") == "11:40"
    assert calls[1][1].destination_start.strftime("%H:%M") == "11:40"
    assert calls[2][1].origin_start.strftime("%H:%M") == "11:40"
    assert value.model_dump() == before


@pytest.mark.parametrize(
    "status",
    [
        "reported_closed",
        "outside_reported_hours",
        "hours_unknown",
        "outside_coverage",
        "date_needed",
    ],
)
def test_unknown_or_conflicting_hours_stop_before_route_calls(monkeypatch, status):
    value, metadata = plan()
    calls = providers(monkeypatch, status=status)
    with pytest.raises(HTTPException) as error:
        recheck_move(None, None, None, value, metadata, checks())
    assert error.value.detail == "LIVE_CHECK_HOURS_NOT_CONFIRMED"
    assert len(calls) == 1


@pytest.mark.parametrize(
    "spare,warnings,code",
    [
        (-1, [], "LIVE_CHECK_ROUTE_SHORTFALL"),
        (5, ["Private road"], "LIVE_CHECK_ROUTE_WARNING"),
    ],
)
def test_route_failures_do_not_become_approval(monkeypatch, spare, warnings, code):
    value, metadata = plan()
    providers(monkeypatch, spare=spare, warnings=warnings)
    with pytest.raises(HTTPException) as error:
        recheck_move(None, None, None, value, metadata, checks())
    assert error.value.detail == code


def test_missing_adjacent_location_and_provider_outage_stop_acceptance(monkeypatch):
    value, metadata = plan()
    providers(monkeypatch)
    value.activities[0].place_id = None
    with pytest.raises(HTTPException) as error:
        recheck_move(None, None, None, value, metadata, checks())
    assert error.value.detail == "LIVE_CHECK_LOCATION_REQUIRED"

    value.activities[0].place_id = uuid4()

    def outage(*args):
        raise HTTPException(503, "GOOGLE_PLACES_UNAVAILABLE")

    monkeypatch.setattr(google_places, "google_check", outage)
    with pytest.raises(HTTPException) as error:
        recheck_move(None, None, None, value, metadata, checks())
    assert error.value.status_code == 503


def test_exact_date_cannot_be_replaced_with_a_better_coverage_date(monkeypatch):
    value, metadata = plan()
    value.date_mode = "exact"
    value.start_date = date(2027, 5, 1)
    assert planned_visit_date(value, metadata) == date(2027, 5, 1)
    calls = providers(monkeypatch)
    with pytest.raises(HTTPException) as error:
        recheck_move(None, None, None, value, metadata, checks())
    assert error.value.detail == "LIVE_CHECK_DATE_MISMATCH" and not calls


def test_first_or_last_activity_does_not_invent_an_extra_leg(monkeypatch):
    value, metadata = plan()
    metadata["command"]["activity_id"] = str(value.activities[0].logical_id)
    calls = providers(monkeypatch)
    recheck_move(None, None, None, value, metadata, checks())
    assert len(calls) == 2


def test_live_guard_rejection_keeps_proposal_pending_then_explicit_provisional_accept_works(
    context, monkeypatch
):
    client, _, _ = context
    base, _, tag, body = moves.setup(client)
    proposed = moves.propose(client, base, tag, body).json()["data"]

    def reject(*args):
        raise HTTPException(503, "GOOGLE_PLACES_UNAVAILABLE")

    monkeypatch.setattr(proposals, "recheck_move", reject)
    request = {
        "expected_current_version_id": proposed["base_current_version_id"],
        "acknowledged_issue_ids": [
            i["id"] for i in proposed["validation"]["issues"] if i["acknowledgeable"]
        ],
        "live_check": checks().model_dump(mode="json"),
    }
    path = base + f"/proposals/{proposed['id']}/accept"
    failed = client.post(path, json=request, headers={"Idempotency-Key": str(uuid4())})
    assert failed.status_code == 503
    assert (
        client.get(base + f"/proposals/{proposed['id']}").json()["data"]["status"]
        == "pending"
    )
    assert moves.accept(client, base, proposed).status_code == 200


def test_successful_retry_does_not_repeat_live_provider_calls(context, monkeypatch):
    client, db, _ = context
    base, _, tag, body = moves.setup(client)
    proposed = moves.propose(client, base, tag, body).json()["data"]
    calls = []
    monkeypatch.setattr(proposals, "recheck_move", lambda *args: calls.append(args))
    request = {
        "expected_current_version_id": proposed["base_current_version_id"],
        "acknowledged_issue_ids": [
            i["id"] for i in proposed["validation"]["issues"] if i["acknowledgeable"]
        ],
        "live_check": checks().model_dump(mode="json"),
    }
    path = base + f"/proposals/{proposed['id']}/accept"
    headers = {"Idempotency-Key": str(uuid4())}
    assert client.post(path, json=request, headers=headers).status_code == 200
    assert client.post(path, json=request, headers=headers).status_code == 200
    assert len(calls) == 1
    from uuid import UUID

    from app.persistence.models import PlanVersion

    row = db.get(PlanVersion, UUID(proposed["candidate_version_id"]))
    assert "live_check" not in row.validation_report


def test_exact_date_counts_long_stays_and_inbound_overnights():
    import json

    value, metadata = plan()
    first = value.stops[0].model_copy(
        update={"client_id": str(uuid4()), "desired_nights": 20}
    )
    target = value.stops[0]
    value.stops = [first, target]
    value.date_mode = "exact"
    value.start_date = date(2026, 11, 1)
    metadata["scope"]["local_day_offset"] = 4
    from app.trips.schemas import TravelPreference

    key = json.dumps([first.client_id, target.client_id], separators=(",", ":"))
    value.preferences.travel_preferences[key] = TravelPreference(
        mode="train", hours="24", overnight=2, rate="", basis="person"
    )
    assert planned_visit_date(value, metadata) == date(2026, 11, 27)


def test_other_proposal_operations_cannot_silently_ignore_live_check(context):
    client, _, _ = context
    base, _, tag, _ = moves.setup(client)
    proposed = client.post(
        base + "/draft/submit",
        headers={"If-Match": tag, "Idempotency-Key": str(uuid4())},
    ).json()["data"]
    response = client.post(
        base + f"/proposals/{proposed['id']}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "expected_current_version_id": proposed["base_current_version_id"],
            "acknowledged_issue_ids": [
                i["id"]
                for i in proposed["validation"]["issues"]
                if i["acknowledgeable"]
            ],
            "live_check": checks().model_dump(mode="json"),
        },
    )
    assert (
        response.status_code == 422
        and response.json()["code"] == "LIVE_CHECK_UNSUPPORTED"
    )
    assert (
        client.get(base + f"/proposals/{proposed['id']}").json()["data"]["status"]
        == "pending"
    )
