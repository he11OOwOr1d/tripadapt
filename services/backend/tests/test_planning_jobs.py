from datetime import timedelta
from uuid import uuid4

import pytest
import test_trips
from sqlalchemy import select

from app.api.identity import TrustedIdentity, verified_identity
from app.config import settings
from app.jobs.worker import claim as worker_claim
from app.jobs.worker import heartbeat, now, publish, retry
from app.main import app
from app.persistence.models import AppUser
from app.planning.fixture import generate_day, validate_scope
from app.trips.schemas import PlanInput


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings, "planning_fixtures_enabled", True)
    for result in test_trips.context.__wrapped__():
        result[1].expire_on_commit = False
        result[1].info["claim_subject"] = result[2].subject
        yield result


def claim(db):
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == db.info["claim_subject"])
    )
    return worker_claim(db, owner_id=owner)


def setup(client):
    stop = str(uuid4())
    activity = dict(
        logical_id=str(uuid4()),
        stop_logical_id=stop,
        user_label="Fixed morning",
        local_day_offset=0,
        local_start_time="10:00",
        duration_minutes=60,
        fixed=True,
        booked=True,
        completed=True,
    )
    row = client.post(
        "/api/v1/trips",
        json={
            "title": "Job test",
            "plan": {
                "stops": [
                    dict(
                        client_id=stop,
                        name="Jaipur",
                        timezone="Asia/Kolkata",
                        desired_nights=2,
                    )
                ],
                "activities": [activity],
            },
        },
    ).json()["data"]
    base = f"/api/v1/trips/{row['id']}"
    tag = client.get(f"{base}/versions/{row['draft_version_id']}").headers["etag"]
    body = {
        "operation": "generate",
        "engine": "fixture",
        "base_version_id": row["draft_version_id"],
        "scope": {
            "type": "selected_day",
            "stop_logical_id": stop,
            "local_day_offset": 0,
        },
    }
    return base, row, tag, body


def create(client, base, tag, body, key=None):
    return client.post(
        base + "/planning-jobs",
        headers={"If-Match": tag, "Idempotency-Key": key or str(uuid4())},
        json=body,
    )


def candidate(job):
    scope = job.input["request"]["scope"]
    return generate_day(
        PlanInput.model_validate(job.input["plan"]),
        scope["stop_logical_id"],
        scope["local_day_offset"],
        job.id,
    )


def test_queue_publish_review_accept_and_protected_items(context):
    client, db, _ = context
    base, trip, tag, body = setup(client)
    response = create(client, base, tag, body)
    assert response.status_code == 202, response.text
    assert response.headers["Location"].startswith("/api/v1/jobs/")
    job = claim(db)
    assert heartbeat(db, job.id, job.lease_token)
    plan = candidate(job)
    assert (
        plan.activities[0].fixed
        and plan.activities[0].completed
        and plan.activities[0].booked
    )
    token = job.lease_token
    assert publish(db, job.id, token, plan)
    assert not publish(db, job.id, token, plan)
    db.commit()
    view = client.get(f"/api/v1/jobs/{job.id}").json()["data"]
    assert view["status"] == "succeeded"
    proposal = client.get(base + f"/proposals/{view['proposal_id']}").json()["data"]
    assert proposal["source"] == "fixture"
    assert len(proposal["plan"]["activities"]) == 3
    assert (
        len(
            client.get(f"{base}/versions/{trip['draft_version_id']}").json()["data"][
                "activities"
            ]
        )
        == 1
    )
    accept_body = {
        "expected_current_version_id": None,
        "acknowledged_issue_ids": [
            i["id"] for i in proposal["validation"]["issues"] if i["acknowledgeable"]
        ],
    }
    accepted = client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json=accept_body,
    )
    assert accepted.status_code == 200, accepted.text
    draft = client.get(f"{base}/versions/{trip['draft_version_id']}").json()["data"]
    assert draft["edit_sequence"] == 1 and len(draft["activities"]) == 3
    assert (
        client.post(f"/api/v1/jobs/{job.id}/cancel").json()["data"]["status"]
        == "succeeded"
    )


def test_idempotency_admission_and_private_polling(context):
    client, db, _ = context
    base, _, tag, body = setup(client)
    key = str(uuid4())
    first = create(client, base, tag, body, key).json()["data"]
    assert create(client, base, tag, body, key).json()["data"]["id"] == first["id"]
    assert create(client, base, tag, body).json()["code"] == "PLANNING_ALREADY_RUNNING"
    changed = {**body, "scope": {**body["scope"], "local_day_offset": 1}}
    assert (
        create(client, base, tag, changed, key).json()["code"]
        == "IDEMPOTENCY_KEY_REUSED"
    )
    assert (
        client.get(f"/api/v1/jobs/{first['id']}").headers["Cache-Control"]
        == "private, no-store"
    )
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "other", str(uuid4()), "other@example.org", "other@example.org"
    )
    assert client.get(f"/api/v1/jobs/{first['id']}").status_code == 404
    assert client.post(f"/api/v1/jobs/{first['id']}/cancel").status_code == 404


def test_cancel_queued_and_running_without_publishing(context):
    client, db, _ = context
    base, _, tag, body = setup(client)
    queued = create(client, base, tag, body).json()["data"]
    assert (
        client.post(f"/api/v1/jobs/{queued['id']}/cancel").json()["data"]["status"]
        == "cancelled"
    )
    assert claim(db) is None
    db.commit()
    create(client, base, tag, body)
    job = claim(db)
    plan, token = candidate(job), job.lease_token
    db.commit()
    assert client.post(f"/api/v1/jobs/{job.id}/cancel").json()["data"][
        "cancel_requested"
    ]
    assert not publish(db, job.id, token, plan)
    assert job.status == "cancelled" and job.proposal_id is None


def test_lease_recovery_fences_old_attempt_and_bounds_retries(context):
    client, db, _ = context
    base, _, tag, body = setup(client)
    create(client, base, tag, body)
    job = claim(db)
    old_token, plan = job.lease_token, candidate(job)
    job.lease_until = now() - timedelta(seconds=1)
    db.flush()
    recovered = claim(db)
    assert recovered.id == job.id and recovered.attempts == 2
    assert not publish(db, job.id, old_token, plan)
    retry(db, recovered.id, recovered.lease_token)
    assert recovered.status == "queued"
    recovered.available_at = now() - timedelta(seconds=1)
    db.flush()
    third = claim(db)
    assert third.attempts == 3
    third.lease_until = now() - timedelta(seconds=1)
    db.flush()
    assert claim(db) is None
    assert third.status == "failed" and third.error_code == "ATTEMPTS_EXHAUSTED"


def test_changed_trip_supersedes_result(context):
    client, db, _ = context
    base, _, tag, body = setup(client)
    create(client, base, tag, body)
    job = claim(db)
    plan = candidate(job)
    db.commit()
    changed = client.post(
        base + "/draft/commands",
        headers={"If-Match": tag},
        json={
            "commands": [{"type": "activity.replace_user_schedule", "activities": []}]
        },
    )
    assert changed.status_code == 200
    assert not publish(db, job.id, job.lease_token, plan)
    assert job.status == "superseded" and job.proposal_id is None


def test_request_validation_and_disabled_mode(context, monkeypatch):
    client, _, _ = context
    base, _, tag, body = setup(client)
    bad = {**body, "scope": {**body["scope"], "local_day_offset": 99}}
    assert create(client, base, tag, bad).status_code == 422
    assert create(client, base, '"draft:wrong:0"', body).status_code == 412
    monkeypatch.setattr(settings, "planning_fixtures_enabled", False)
    assert create(client, base, tag, body).json()["code"] == "FIXTURE_PLANNING_DISABLED"


def test_fixture_scope_guard_and_stable_ids():
    stop = str(uuid4())
    plan = PlanInput.model_validate(
        {
            "stops": [
                {
                    "client_id": stop,
                    "name": "Place",
                    "timezone": "UTC",
                    "desired_nights": 20,
                }
            ]
        }
    )
    ident = uuid4()
    result = generate_day(plan, stop, 15, ident)
    assert result == generate_day(plan, stop, 15, ident)
    validate_scope(plan, result, stop, 15)
    assert len(generate_day(result, stop, 15, uuid4()).activities) == 2
    result.activities[0].fixed = True
    with pytest.raises(ValueError):
        validate_scope(plan, result, stop, 15)


def test_groq_job_publishes_reasons_and_requires_ai_evidence_ack(context, monkeypatch):
    client, db, _ = context
    from pydantic import SecretStr

    from app.agents.day_graph import AI_ISSUE

    monkeypatch.setattr(settings, "planning_ai_enabled", True)
    monkeypatch.setattr(settings, "groq_api_key", SecretStr("unit-test-only"))
    base, _, tag, body = setup(client)
    body["engine"] = "groq"
    response = create(client, base, tag, body)
    assert response.status_code == 202
    assert response.json()["data"]["engine"] == "groq"
    job = claim(db)
    from uuid import uuid5

    from app.trips.schemas import ActivityInput

    plan = PlanInput.model_validate(job.input["plan"])
    scope = job.input["request"]["scope"]
    plan.activities.append(
        ActivityInput(
            logical_id=uuid5(job.id, "groq:0:rest"),
            stop_logical_id=scope["stop_logical_id"],
            user_label="Rest break",
            kind="rest",
            local_day_offset=0,
            local_start_time="12:00",
            duration_minutes=30,
        )
    )
    assert publish(
        db,
        job.id,
        job.lease_token,
        plan,
        {
            "engine": "groq",
            "summary": "Unit test reason",
            "evidence": "sample_catalog",
            "additions": [
                {"candidate_id": "rest", "start": "12:00", "reason": "Sample rest"}
            ],
        },
    )
    proposal_id = job.proposal_id
    db.commit()
    proposal = client.get(base + f"/proposals/{proposal_id}").json()["data"]
    assert proposal["source"] == "ai"
    assert proposal["generation"]["summary"] == "Unit test reason"
    assert any(i["id"] == AI_ISSUE["id"] for i in proposal["validation"]["issues"])
    body = {
        "expected_current_version_id": None,
        "acknowledged_issue_ids": [
            i["id"] for i in proposal["validation"]["issues"] if i["acknowledgeable"]
        ],
    }
    result = client.post(
        base + f"/proposals/{proposal_id}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json=body,
    )
    assert result.status_code == 200, result.text
    assert result.json()["data"]["source"] == "ai"
