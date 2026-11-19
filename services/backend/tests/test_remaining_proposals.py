from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import pytest
import test_place_references
import test_proposals
import test_trips
from sqlalchemy import select

from app.api import journeys, replanning
from app.persistence.models import Activity, DiscoveredPlace, PlanVersion, Trip
from app.providers.geoapify_checks import parse_route


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def setup(context, monkeypatch):
    client, db, _ = context
    db.expire_on_commit = False
    reference = test_place_references.selected(client, monkeypatch)
    stop = str(uuid4())
    ids = [str(uuid4()) for _ in range(4)]
    now = datetime(
        2026, 11, 14, 10, 15, tzinfo=ZoneInfo(reference["timezone"])
    ).astimezone(timezone.utc)
    state = SimpleNamespace(now=now, warnings=[], calls=0, duration="1200s")
    monkeypatch.setattr(replanning, "current_time", lambda: state.now)
    places = []
    for i in range(4):
        place = DiscoveredPlace(
            id=uuid4(),
            destination_reference_id=UUID(reference["reference_id"]),
            payload=dict(
                external_id=f"node/{i + 100}",
                name=f"QA source {i}",
                category="park",
                latitude=35.02 + i * 0.01,
                longitude=135.75,
                source="OpenStreetMap contributors via Overpass",
                retrieved_at=now.isoformat(),
            ),
        )
        db.add(place)
        places.append(place.id)
    db.commit()
    plan = dict(
        stops=[
            dict(
                client_id=stop,
                name=reference["label"],
                timezone=reference["timezone"],
                desired_nights=20,
                place_reference_id=reference["reference_id"],
            )
        ],
        activities=[
            dict(
                logical_id=ident,
                stop_logical_id=stop,
                user_label=f"Visit {i}",
                local_day_offset=12,
                local_start_time=start,
                duration_minutes=30,
                completed=i == 0,
                fixed=i == 3,
                place_id=str(places[max(0, i - 1)]),
            )
            for i, (ident, start) in enumerate(
                zip(ids, ["08:00", "10:20", "11:00", "13:00"])
            )
        ],
    )
    trip = client.post(
        "/api/v1/trips", json={"title": "Remaining proposal QA", "plan": plan}
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"

    def route(*args, **kwargs):
        state.calls += 1
        # Run the real parser so malformed or missing routes fail like production.
        estimate = parse_route(
            {"features": []}
            if state.duration is None
            else {
                "features": [
                    {
                        "properties": {
                            "time": float(state.duration[:-1]),
                            "distance": 2000,
                        }
                    }
                ]
            }
        )
        return estimate._replace(warnings=state.warnings)

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=route))
    params = dict(basis="draft", stop_id=stop, local_day_offset=12)
    ctx = client.get(base + "/replanning/context", params=params).json()["data"]
    body = dict(
        basis="draft",
        base_version_id=ctx["base_version_id"],
        scope="remaining_day",
        stop_id=stop,
        local_day_offset=12,
        local_date="2026-11-14",
        local_time="10:15",
        utc_offset_minutes=ctx["utc_offset_minutes"],
        current_location_place_id=str(places[3]),
        confirmed=True,
        mode="DRIVE",
        buffer_minutes=10,
    )
    preview = client.post(
        base + "/replanning/preview", json=body, headers={"If-Match": ctx["base_etag"]}
    )
    assert preview.status_code == 200, preview.text
    body["preview_changes"] = preview.json()["data"]["changes"]
    return client, db, base, trip, ctx, body, state


def save(values, key=None):
    client, _, base, _, ctx, body, _ = values
    return client.post(
        base + "/proposals/remaining-day",
        json=body,
        headers={"If-Match": ctx["base_etag"], "Idempotency-Key": key or str(uuid4())},
    )


def test_save_reopen_accept_updates_draft_only_after_acceptance(context, monkeypatch):
    values = setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    key = str(uuid4())
    saved = save(values, key)
    assert saved.status_code == 201, saved.text
    proposal = saved.json()["data"]
    calls = state.calls
    assert (
        save(values, key).json()["data"]["id"] == proposal["id"]
        and state.calls == calls
    )
    assert (
        client.get(base + f"/proposals/{proposal['id']}").json()["data"]["generation"][
            "operation"
        ]
        == "remaining_day"
    )
    draft = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    assert [
        str(a.local_start_time)[:5]
        for a in db.scalars(
            select(Activity)
            .where(Activity.version_id == draft.id)
            .order_by(Activity.local_start_time)
        )
    ] == ["08:00", "10:20", "11:00", "13:00"]
    db.commit()
    # A shorter route still fits the frozen review. Acceptance keeps its times.
    state.duration = "1140s"
    acceptance_key = str(uuid4())
    accepted = test_proposals.accept(client, base, proposal, key=acceptance_key)
    assert accepted.status_code == 200, accepted.text
    assert state.calls > calls
    checked_calls = state.calls
    replay = test_proposals.accept(client, base, proposal, key=acceptance_key)
    assert replay.status_code == 200, replay.text
    assert replay.json()["data"] == accepted.json()["data"]
    assert state.calls == checked_calls
    assert [
        str(a.local_start_time)[:5]
        for a in db.scalars(
            select(Activity)
            .where(Activity.version_id == draft.id)
            .order_by(Activity.local_start_time)
        )
    ] == ["08:00", "10:45", "11:45", "13:00"]
    candidate = db.get(PlanVersion, UUID(proposal["candidate_version_id"]))
    assert "journeys" not in candidate.validation_report["remaining_day"]
    assert db.get(Trip, UUID(trip["id"])).current_version_id == candidate.id


@pytest.mark.parametrize(
    "failure", ["clock", "warning", "tamper", "stale", "route_drift", "no_route"]
)
def test_acceptance_failures_leave_proposal_pending(context, monkeypatch, failure):
    values = setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    proposal = save(values).json()["data"]
    if failure == "clock":
        state.now += timedelta(minutes=6)
    if failure == "route_drift":
        state.duration = "1260s"
    if failure == "no_route":
        state.duration = None
    if failure == "warning":
        state.warnings = ["Restricted route"]
    if failure in ("tamper", "stale"):
        ident = (
            proposal["candidate_version_id"]
            if failure == "tamper"
            else trip["draft_version_id"]
        )
        row = db.get(PlanVersion, UUID(ident))
        item = db.scalars(select(Activity).where(Activity.version_id == row.id)).first()
        item.user_label = "Altered"
        if failure == "stale":
            row.edit_sequence += 1
        db.commit()
    response = test_proposals.accept(client, base, proposal)
    assert response.status_code == (503 if failure == "no_route" else 409), (
        response.text
    )
    expected_codes = {
        "clock": "REPLAN_TIME_STALE",
        "warning": "REPLAN_ROUTE_WARNING",
        "route_drift": "REPLAN_REVIEW_EXPIRED",
        "no_route": "ROUTES_UNAVAILABLE",
    }
    if failure in expected_codes:
        assert response.json()["code"] == expected_codes[failure]
    assert (
        client.get(base + f"/proposals/{proposal['id']}").json()["data"]["status"]
        == "pending"
    )
    assert db.get(Trip, UUID(trip["id"])).current_version_id is None
    if failure == "route_drift":
        assert [
            str(item.local_start_time)[:5]
            for item in db.scalars(
                select(Activity)
                .where(Activity.version_id == UUID(trip["draft_version_id"]))
                .order_by(Activity.local_start_time)
            )
        ] == ["08:00", "10:20", "11:00", "13:00"]


def test_changed_preview_and_cross_operation_key_are_rejected(context, monkeypatch):
    values = setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    body["preview_changes"][0]["after"] = "10:46"
    assert save(values).json()["code"] == "REPLAN_PREVIEW_CHANGED"
    body["preview_changes"][0]["after"] = "10:45"
    key = str(uuid4())
    assert save(values, key).status_code == 201
    assert (
        test_proposals.submit(client, base, ctx["base_etag"], key).json()["code"]
        == "IDEMPOTENCY_KEY_REUSED"
    )
    body["mode"] = "WALK"
    assert save(values, key).json()["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_accepted_basis_cannot_overwrite_a_different_draft(context, monkeypatch):
    values = setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    original = test_proposals.submit(client, base, ctx["base_etag"]).json()["data"]
    assert test_proposals.accept(client, base, original).status_code == 200
    accepted = client.get(
        base + "/replanning/context",
        params=dict(basis="accepted", stop_id=body["stop_id"], local_day_offset=12),
    ).json()["data"]
    body.update(basis="accepted", base_version_id=accepted["base_version_id"])
    row = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    item = db.scalars(select(Activity).where(Activity.version_id == row.id)).first()
    item.user_label = "A newer personal edit"
    row.edit_sequence += 1
    db.commit()
    response = client.post(
        base + "/proposals/remaining-day",
        json=body,
        headers={"If-Match": accepted["base_etag"], "Idempotency-Key": str(uuid4())},
    )
    assert (
        response.status_code == 409
        and response.json()["code"] == "REPLAN_DRAFT_DIVERGED"
    )


def test_missing_ack_does_not_call_routes_and_discard_remains_available(
    context, monkeypatch
):
    values = setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    proposal = save(values).json()["data"]
    calls = state.calls
    denied = test_proposals.accept(client, base, proposal, ack=False)
    assert (
        denied.status_code == 409
        and denied.json()["code"] == "ACKNOWLEDGEMENT_REQUIRED"
        and state.calls == calls
    )
    response = client.post(base + f"/proposals/{proposal['id']}/discard")
    assert response.status_code == 200, response.text


def lighter(values, **changes):
    client, _, base, _, ctx, body, _ = values
    body = {k: v for k, v in body.items() if k != "preview_changes"} | changes
    preview = client.post(
        base + "/replanning/preview", json=body, headers={"If-Match": ctx["base_etag"]}
    )
    return body, preview


def test_tired_traveler_rests_and_skips_chosen_flexible_activity(context, monkeypatch):
    values = setup(context, monkeypatch)
    client, db, base, trip, ctx, _, _ = values
    path = base + f"/versions/{trip['draft_version_id']}"
    acts = {a["user_label"]: a for a in client.get(path).json()["data"]["activities"]}
    skip = acts["Visit 1"]["logical_id"]
    # A paid ticket and an estimate for the activity the traveler will skip.
    version = client.get(path)
    costs = [
        dict(
            id=str(uuid4()),
            category="activity",
            label=label,
            unit="per_group",
            quantity=1,
            amount="20",
            status=status,
            activity_id=skip,
        )
        for label, status in (("Ticket", "paid"), ("Snacks", "estimated"))
    ]
    saved = client.post(
        base + "/draft/commands",
        headers={"If-Match": version.headers["etag"]},
        json={"commands": [{"type": "cost.replace_records", "costs": costs}]},
    )
    assert saved.status_code == 200, saved.text
    ctx = client.get(
        base + "/replanning/context",
        params=dict(basis="draft", stop_id=values[5]["stop_id"], local_day_offset=12),
    ).json()["data"]
    values = (
        *values[:4],
        ctx,
        {**values[5], "base_version_id": ctx["base_version_id"]},
        values[6],
    )
    body, preview = lighter(values, rest_minutes=30, skip_activity_ids=[skip])
    assert preview.status_code == 200, preview.text
    data = preview.json()["data"]
    assert [s["label"] for s in data["skipped"]] == ["Visit 1"]
    # 10:15 + 30 rest + 20 drive + 10 buffer = 11:15 for the next flexible visit.
    assert [(c["label"], c["after"]) for c in data["changes"]] == [
        ("Visit 2", "11:15"),
        ("Visit 3", "13:00"),
    ]
    body["preview_changes"] = data["changes"]
    proposal = client.post(
        base + "/proposals/remaining-day",
        json=body,
        headers={"If-Match": ctx["base_etag"], "Idempotency-Key": str(uuid4())},
    )
    assert proposal.status_code == 201, proposal.text
    proposal = proposal.json()["data"]
    issues = {i["code"]: i for i in proposal["validation"]["issues"]}
    fatigue = issues["REMAINING_DAY_FATIGUE"]
    assert fatigue["acknowledgeable"] and "Visit 1 (10:20)" in fatigue["detail"]
    assert "rest for 30 minutes" in fatigue["detail"]
    # Nothing changes until acceptance, which needs every acknowledgement.
    labels = [a["user_label"] for a in client.get(path).json()["data"]["activities"]]
    assert "Visit 1" in labels
    db.commit()
    assert test_proposals.accept(client, base, proposal, ack=False).status_code == 409
    accepted = test_proposals.accept(client, base, proposal)
    assert accepted.status_code == 200, accepted.text
    after = {a["user_label"]: a for a in client.get(path).json()["data"]["activities"]}
    assert (
        "Visit 1" not in after and after["Visit 2"]["local_start_time"][:5] == "11:15"
    )
    left = client.get(path).json()["data"]["costs"]
    assert [(c["label"], c["link_removed"]) for c in left] == [("Ticket", True)]
    assert left[0]["id"] == costs[0]["id"]
    assert left[0]["amount"] == "20.00"
    assert left[0]["status"] == "paid"
    assert left[0]["activity_id"] is None
    snapshot = client.get(f"{base}/versions/{proposal['candidate_version_id']}")
    assert snapshot.json()["data"]["costs"] == left


def test_skips_must_be_remaining_flexible_items(context, monkeypatch):
    values = setup(context, monkeypatch)
    client, _, base, trip, _, _, _ = values
    path = base + f"/versions/{trip['draft_version_id']}"
    acts = {
        a["user_label"]: a["logical_id"]
        for a in client.get(path).json()["data"]["activities"]
    }
    for label, code in (
        ("Visit 3", "REPLAN_SKIP_PROTECTED"),
        ("Visit 0", "REPLAN_SKIP_INVALID"),
    ):
        _, preview = lighter(values, skip_activity_ids=[acts[label]])
        assert preview.status_code == 409 and preview.json()["code"] == code
    _, preview = lighter(values, skip_activity_ids=[str(uuid4())])
    assert preview.json()["code"] == "REPLAN_SKIP_INVALID"
    _, preview = lighter(values, rest_minutes=241)
    assert preview.status_code == 422


def test_remaining_hours_block_acceptance_until_visits_fit(context, monkeypatch):
    from fastapi import HTTPException

    from app.api import place_checks

    values = setup(context, monkeypatch)
    client, db, base, trip, ctx, body, state = values
    original = test_proposals.submit(client, base, ctx["base_etag"]).json()["data"]
    assert test_proposals.accept(client, base, original).status_code == 200
    metadata = client.get(base)
    started = client.patch(
        base,
        headers={"If-Match": metadata.headers["etag"]},
        json={"lifecycle": "active"},
    )
    assert started.status_code == 200, started.text
    ctx = client.get(
        base + "/replanning/context",
        params=dict(basis="accepted", stop_id=body["stop_id"], local_day_offset=12),
    ).json()["data"]
    body.update(basis="accepted", base_version_id=ctx["base_version_id"])
    saved = save((client, db, base, trip, ctx, body, state))
    assert saved.status_code == 201, saved.text
    proposal = saved.json()["data"]
    visits = body["preview_changes"]
    checks = {
        "visit_date": body["local_date"],
        "mode": body["mode"],
        "buffer_minutes": body["buffer_minutes"],
    }
    expected_checks = [
        (body["local_date"], visit["after"], visit["duration_minutes"])
        for visit in visits
    ]
    observed = []
    hours_status = "outside_reported_hours"

    def check_hours(check, *_):
        observed.append(
            (
                check.visit_date.isoformat(),
                check.start.isoformat(timespec="minutes"),
                check.duration_minutes,
            )
        )
        if hours_status == "provider_error":
            raise HTTPException(503, "PLACE_HOURS_ACCESS_DENIED")
        return {"data": SimpleNamespace(status=hours_status)}

    monkeypatch.setattr(place_checks, "hours_check", check_hours)

    def accept(live_checks=checks):
        return client.post(
            base + f"/proposals/{proposal['id']}/accept",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "expected_current_version_id": proposal["base_current_version_id"],
                "acknowledged_issue_ids": [
                    issue["id"]
                    for issue in proposal["validation"]["issues"]
                    if issue["acknowledgeable"]
                ],
                "day_live_check": live_checks,
            },
        )

    route_calls = state.calls
    mismatch = accept({**checks, "buffer_minutes": checks["buffer_minutes"] + 1})
    assert mismatch.status_code == 422, mismatch.text
    assert mismatch.json()["code"] == "LIVE_CHECK_CONTEXT_MISMATCH"
    assert not observed
    assert state.calls == route_calls

    wrong_date = accept({**checks, "visit_date": "2026-11-15"})
    assert wrong_date.status_code == 422, wrong_date.text
    assert wrong_date.json()["code"] == "LIVE_CHECK_DATE_MISMATCH"
    assert not observed
    assert state.calls == route_calls

    hours_status = "provider_error"
    denied = accept()
    assert denied.status_code == 503, denied.text
    assert denied.json()["code"] == "PLACE_HOURS_ACCESS_DENIED"
    assert denied.json()["day_check"]["reason"] == "provider_error"
    assert state.calls == route_calls
    observed.clear()

    hours_status = "outside_reported_hours"
    blocked = accept()
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["code"] == "LIVE_CHECK_HOURS_NOT_CONFIRMED"
    assert blocked.json()["day_check"]["reason"] == "outside_hours"
    assert observed == expected_checks[:1]
    assert state.calls == route_calls
    assert db.get(Trip, UUID(trip["id"])).current_version_id == UUID(
        original["candidate_version_id"]
    )
    assert [
        str(item.local_start_time)[:5]
        for item in db.scalars(
            select(Activity)
            .where(Activity.version_id == UUID(trip["draft_version_id"]))
            .order_by(Activity.local_start_time)
        )
    ] == ["08:00", "10:20", "11:00", "13:00"]
    db.commit()
    assert (
        client.get(base + f"/proposals/{proposal['id']}").json()["data"]["status"]
        == "pending"
    )

    observed.clear()
    hours_status = "fits_reported_hours"
    accepted = accept()
    assert accepted.status_code == 200, accepted.text
    assert observed == expected_checks
    assert state.calls > route_calls
    assert client.get(base).json()["data"]["lifecycle"] == "active"
    trip_row = db.get(Trip, UUID(trip["id"]))
    assert trip_row.current_version_id == UUID(proposal["candidate_version_id"])
    for version_id in (trip_row.draft_version_id, trip_row.current_version_id):
        starts = db.scalars(
            select(Activity.local_start_time)
            .where(Activity.version_id == version_id)
            .order_by(Activity.local_start_time)
        )
        assert [str(start)[:5] for start in starts] == [
            "08:00",
            "10:45",
            "11:45",
            "13:00",
        ]
