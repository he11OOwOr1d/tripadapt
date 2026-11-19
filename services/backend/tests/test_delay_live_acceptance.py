from datetime import date
from uuid import uuid4

import pytest
import test_live_acceptance as live
from fastapi import HTTPException

from app.planning.live_acceptance import DelayLiveAcceptance, recheck_delay


def setup():
    plan, metadata = live.plan()
    checks = DelayLiveAcceptance(visit_date=date(2026, 11, 13))
    return plan, metadata, checks


def test_all_affected_hours_and_unique_connecting_legs_use_candidate(monkeypatch):
    plan, metadata, checks = setup()
    before = plan.model_dump()
    calls = live.providers(monkeypatch)
    recheck_delay(None, None, None, plan, metadata, checks)
    assert [kind for kind, _ in calls] == ["hours", "hours", "route", "route"]
    assert [
        body.start.strftime("%H:%M") for kind, body in calls if kind == "hours"
    ] == ["11:40", "14:00"]
    assert plan.model_dump() == before


@pytest.mark.parametrize(
    "change,code",
    [
        ("location", "LIVE_CHECK_LOCATION_REQUIRED"),
        ("date", "LIVE_CHECK_DATE_MISMATCH"),
    ],
)
def test_invalid_coverage_fails_before_paid_calls(monkeypatch, change, code):
    plan, metadata, checks = setup()
    if change == "location":
        plan.activities[0].place_id = None
    if change == "date":
        plan.date_mode = "exact"
        plan.start_date = date(2027, 1, 1)
    calls = live.providers(monkeypatch)
    with pytest.raises(HTTPException) as error:
        recheck_delay(None, None, None, plan, metadata, checks)
    assert error.value.detail == code and not calls


@pytest.mark.parametrize(
    "status,spare,warnings,code",
    [
        ("hours_unknown", 5, [], "LIVE_CHECK_HOURS_NOT_CONFIRMED"),
        ("fits_reported_hours", -1, [], "LIVE_CHECK_ROUTE_SHORTFALL"),
        ("fits_reported_hours", 5, ["private"], "LIVE_CHECK_ROUTE_WARNING"),
    ],
)
def test_no_unknown_or_conflict_becomes_approval(
    monkeypatch, status, spare, warnings, code
):
    plan, metadata, checks = setup()
    live.providers(monkeypatch, status, spare, warnings)
    with pytest.raises(HTTPException) as error:
        recheck_delay(None, None, None, plan, metadata, checks)
    assert error.value.detail == code


def test_request_limit_is_not_a_trip_length_limit(monkeypatch):
    plan, metadata, checks = setup()
    for _ in range(5):
        plan.activities.append(
            plan.activities[-1].model_copy(update={"logical_id": uuid4()})
        )
    calls = live.providers(monkeypatch)
    with pytest.raises(HTTPException) as error:
        recheck_delay(None, None, None, plan, metadata, checks)
    assert error.value.detail == "LIVE_CHECK_DAY_LIMIT" and not calls


@pytest.fixture
def context():
    import test_trips

    yield from test_trips.context.__wrapped__()


def test_delay_guard_failure_recovery_retry_and_no_provider_facts_saved(
    context, monkeypatch
):
    from uuid import UUID

    import test_day_delay as delay

    from app.api import proposals
    from app.persistence.models import PlanVersion

    client, db, _ = context
    base, trip, tag, command = delay.create(client)
    proposed = delay.propose(client, base, tag, command).json()["data"]
    request = {
        "expected_current_version_id": proposed["base_current_version_id"],
        "acknowledged_issue_ids": [
            i["id"] for i in proposed["validation"]["issues"] if i["acknowledgeable"]
        ],
        "day_live_check": {"visit_date": "2026-11-13"},
    }
    path = base + f"/proposals/{proposed['id']}/accept"
    calls = []

    def fail(*args):
        calls.append(args)
        raise HTTPException(503, "PLACE_HOURS_UNAVAILABLE")

    monkeypatch.setattr(proposals, "recheck_delay", fail)
    assert (
        client.post(
            path, json=request, headers={"Idempotency-Key": str(uuid4())}
        ).status_code
        == 503
    )
    assert (
        client.get(base + f"/proposals/{proposed['id']}").json()["data"]["status"]
        == "pending"
    )
    monkeypatch.setattr(proposals, "recheck_delay", lambda *args: calls.append(args))
    headers = {"Idempotency-Key": str(uuid4())}
    assert client.post(path, json=request, headers=headers).status_code == 200
    assert client.post(path, json=request, headers=headers).status_code == 200
    assert len(calls) == 2
    changed = {
        **request,
        "day_live_check": {**request["day_live_check"], "mode": "DRIVE"},
    }
    assert client.post(path, json=changed, headers=headers).status_code == 409
    row = db.get(PlanVersion, UUID(proposed["candidate_version_id"]))
    assert "day_live_check" not in row.validation_report


def test_wrong_operation_and_mixed_guards_cannot_bypass_scope(context):
    import test_day_delay as delay

    from app.planning.live_acceptance import LiveAcceptance

    client, _, _ = context
    base, _, tag, command = delay.create(client)
    proposed = delay.propose(client, base, tag, command).json()["data"]
    body = {
        "expected_current_version_id": proposed["base_current_version_id"],
        "acknowledged_issue_ids": [
            i["id"] for i in proposed["validation"]["issues"] if i["acknowledgeable"]
        ],
        "live_check": LiveAcceptance(visit_date=date(2026, 11, 13)).model_dump(
            mode="json"
        ),
    }
    path = base + f"/proposals/{proposed['id']}/accept"
    assert (
        client.post(
            path, json=body, headers={"Idempotency-Key": str(uuid4())}
        ).status_code
        == 422
    )
    body["day_live_check"] = {"visit_date": "2026-11-13"}
    assert (
        client.post(
            path, json=body, headers={"Idempotency-Key": str(uuid4())}
        ).status_code
        == 422
    )
    assert (
        client.get(base + f"/proposals/{proposed['id']}").json()["data"]["status"]
        == "pending"
    )


@pytest.mark.parametrize(
    "status,reason",
    [
        ("outside_reported_hours", "outside_hours"),
        ("outside_coverage", "outside_coverage"),
        ("hours_unknown", "hours_unknown"),
        ("future_unrecognized_status", "hours_unknown"),
    ],
)
def test_visit_failure_identifies_candidate_without_provider_payload(
    monkeypatch, status, reason
):
    from app.planning.live_acceptance import DayCheckFailure

    plan, metadata, checks = setup()
    live.providers(monkeypatch, status=status)
    with pytest.raises(DayCheckFailure) as error:
        recheck_delay(None, None, None, plan, metadata, checks)
    d = error.value.diagnostic.model_dump(mode="json")
    assert d == {
        "kind": "visit",
        "reason": reason,
        "activity_id": str(plan.activities[1].logical_id),
        "from_activity_id": None,
    }


def test_failed_second_visit_is_named_not_the_first(monkeypatch):
    from types import SimpleNamespace

    from app.api import place_checks
    from app.planning.live_acceptance import DayCheckFailure

    plan, metadata, checks = setup()
    calls = live.providers(monkeypatch)

    def hours(body, *args):
        return {
            "data": SimpleNamespace(
                status="hours_unknown"
                if body.source_place_id == plan.activities[-1].place_id
                else "fits_reported_hours"
            )
        }

    monkeypatch.setattr(place_checks, "hours_check", hours)
    with pytest.raises(DayCheckFailure) as error:
        recheck_delay(None, None, None, plan, metadata, checks)
    assert error.value.diagnostic.activity_id == plan.activities[-1].logical_id
    assert not calls  # No route calls after a failed visit.


@pytest.mark.parametrize(
    "spare,warnings,reason",
    [(-1, [], "shortfall"), (5, ["secret provider warning payload"], "route_warning")],
)
def test_route_failure_names_exact_edge_without_raw_warning(
    monkeypatch, spare, warnings, reason
):
    from app.planning.live_acceptance import DayCheckFailure

    plan, metadata, checks = setup()
    live.providers(monkeypatch, spare=spare, warnings=warnings)
    with pytest.raises(DayCheckFailure) as error:
        recheck_delay(None, None, None, plan, metadata, checks)
    d = error.value.diagnostic
    assert d.kind == "journey" and d.reason == reason
    assert (
        d.from_activity_id == plan.activities[0].logical_id
        and d.activity_id == plan.activities[1].logical_id
    )
    assert "secret" not in d.model_dump_json()


def test_provider_outage_has_safe_context_and_preserves_retry_header(monkeypatch):
    from app.api import place_checks
    from app.planning.live_acceptance import DayCheckFailure

    plan, metadata, checks = setup()

    def outage(*args):
        raise HTTPException(
            429, "PLACE_HOURS_RATE_LIMITED", headers={"Retry-After": "60"}
        )

    monkeypatch.setattr(place_checks, "hours_check", outage)
    with pytest.raises(DayCheckFailure) as error:
        recheck_delay(None, None, None, plan, metadata, checks)
    assert error.value.status_code == 429 and error.value.headers == {
        "Retry-After": "60"
    }
    assert error.value.diagnostic.reason == "provider_error"


def test_problem_context_reaches_client_and_is_not_saved(context, monkeypatch):
    from uuid import UUID

    import test_day_delay as delay

    from app.api import proposals
    from app.persistence.models import PlanVersion
    from app.planning.live_acceptance import day_check_failure

    client, db, _ = context
    base, _, tag, command = delay.create(client)
    proposed = delay.propose(client, base, tag, command).json()["data"]

    def reject(db, user, request, plan, *args):
        target = next(
            a for a in plan.activities if str(a.logical_id) == command["activity_id"]
        )
        day_check_failure("LIVE_CHECK_HOURS_NOT_CONFIRMED", target, "outside_hours")

    monkeypatch.setattr(proposals, "recheck_delay", reject)
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
            "day_live_check": {"visit_date": "2026-11-13"},
        },
    )
    assert response.status_code == 409
    assert response.json()["day_check"] == {
        "kind": "visit",
        "reason": "outside_hours",
        "activity_id": command["activity_id"],
        "from_activity_id": None,
    }
    assert response.headers["content-type"].startswith("application/problem+json")
    assert "no-store" in response.headers["cache-control"]
    assert (
        client.get(base + f"/proposals/{proposed['id']}").json()["data"]["status"]
        == "pending"
    )
    row = db.get(PlanVersion, UUID(proposed["candidate_version_id"]))
    assert "day_check" not in row.validation_report
    db.rollback()
    assert delay.accept(client, base, proposed).status_code == 200
