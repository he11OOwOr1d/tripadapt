from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
import test_remaining_proposals as remaining
import test_trips

from app.api import place_checks


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def accept(values, proposal, checks):
    client, _, base, _, _, _, _ = values
    return client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json=dict(
            expected_current_version_id=proposal["base_current_version_id"],
            acknowledged_issue_ids=[
                i["id"]
                for i in proposal["validation"]["issues"]
                if i["acknowledgeable"]
            ],
            day_live_check=checks,
        ),
    )


def choices(proposal):
    return dict(
        visit_date="2026-11-14",
        mode="DRIVE",
        buffer_minutes=10,
    )


def test_every_remaining_visit_including_commitments_is_checked_then_routes(
    context, monkeypatch
):
    values = remaining.setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    proposal = remaining.save(values).json()["data"]
    calls = []

    def hours(body, *args):
        calls.append(body)
        return {"data": SimpleNamespace(status="fits_reported_hours")}

    monkeypatch.setattr(place_checks, "hours_check", hours)
    routes_before = state.calls
    response = accept(values, proposal, choices(proposal))
    assert response.status_code == 200, response.text
    assert len(calls) == 3 and state.calls > routes_before
    assert [c.start.strftime("%H:%M") for c in calls] == ["10:45", "11:45", "13:00"]
    assert proposal["generation"]["remaining_context"]["location_name"] == "QA source 3"
    assert proposal["generation"]["remaining_context"]["mode"] == "DRIVE"


@pytest.mark.parametrize(
    "status,reason",
    [
        ("outside_reported_hours", "outside_hours"),
        ("unknown", "hours_unknown"),
        ("outside_coverage", "outside_coverage"),
    ],
)
def test_named_hours_failures_leave_pending_without_route_fallback(
    context, monkeypatch, status, reason
):
    values = remaining.setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    proposal = remaining.save(values).json()["data"]
    routes_before = state.calls
    monkeypatch.setattr(
        place_checks,
        "hours_check",
        lambda *args: {"data": SimpleNamespace(status=status)},
    )
    response = accept(values, proposal, choices(proposal))
    assert response.status_code == 409, response.text
    assert response.json()["day_check"]["reason"] == reason
    assert (
        response.json()["day_check"]["activity_id"]
        == proposal["generation"]["changes"][0]["activity_id"]
    )
    assert state.calls == routes_before
    assert (
        client.get(base + f"/proposals/{proposal['id']}").json()["data"]["status"]
        == "pending"
    )


@pytest.mark.parametrize(
    "change,code",
    [
        ({"visit_date": "2026-11-15"}, "LIVE_CHECK_DATE_MISMATCH"),
        ({"mode": "WALK"}, "LIVE_CHECK_CONTEXT_MISMATCH"),
        ({"buffer_minutes": 0}, "LIVE_CHECK_CONTEXT_MISMATCH"),
    ],
)
def test_hours_cannot_change_scope_date_or_route_assumptions(
    context, monkeypatch, change, code
):
    values = remaining.setup(context, monkeypatch)
    proposal = remaining.save(values).json()["data"]
    called = []
    monkeypatch.setattr(place_checks, "hours_check", lambda *args: called.append(args))
    response = accept(values, proposal, {**choices(proposal), **change})
    assert (
        response.status_code == 422 and response.json()["code"] == code and called == []
    )


def test_expired_context_does_not_spend_hours_requests(context, monkeypatch):
    values = remaining.setup(context, monkeypatch)
    proposal = remaining.save(values).json()["data"]
    values[-1].now += timedelta(minutes=6)
    called = []
    monkeypatch.setattr(place_checks, "hours_check", lambda *args: called.append(args))
    response = accept(values, proposal, choices(proposal))
    assert (
        response.status_code == 409
        and response.json()["code"] == "REPLAN_TIME_STALE"
        and called == []
    )
