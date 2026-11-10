from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.api.identity import TrustedIdentity, session, verified_identity
from app.main import app
from app.persistence.database import engine
from app.persistence.models import AppUser, Trip


@pytest.fixture
def context():
    # Real PostgreSQL, outer rollback keeps all test data isolated.
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:

            def database():
                with db.begin():
                    yield db

            identity = TrustedIdentity(
                "test-issuer", str(uuid4()), "test@example.org", "test@example.org"
            )
            app.dependency_overrides[session] = database
            app.dependency_overrides[verified_identity] = lambda: identity
            with TestClient(app) as client:
                yield client, db, identity
            app.dependency_overrides.clear()
        transaction.rollback()


def test_auth_is_closed():
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/trips", headers={"Authorization": "Bearer invented"}
        )
        assert response.status_code == 401
        assert response.json()["code"] == "AUTH_REQUIRED"


def test_save_reopen_identity_and_concurrency(context):
    client, db, identity = context
    me = client.get("/api/v1/me").json()["data"]
    assert client.get("/api/v1/me").json()["data"]["id"] == me["id"]
    response = client.post(
        "/api/v1/trips",
        json={
            "title": "Long route",
            "plan": {
                "date_mode": "duration",
                "desired_days": 30,
                "traveler_count": 6,
                "budget": {"amount": "12345.6789"},
                "stops": [
                    {"name": "Jaipur", "timezone": "Asia/Kolkata", "desired_nights": 4}
                ]
                * 2,
            },
        },
    )
    assert response.status_code == 201, response.text
    trip = response.json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    assert trip["current_version_id"] is None
    assert client.get(base).json()["data"] == trip
    version = client.get(f"{base}/versions/{trip['draft_version_id']}")
    assert version.status_code == 200, version.text
    assert version.json()["data"]["budget"]["amount"] == "12345.6789"
    assert version.json()["data"]["desired_days"] == 30
    stops = client.get(f"{base}/versions/{trip['draft_version_id']}/stops").json()[
        "data"
    ]
    assert [stop["position"] for stop in stops] == [0, 1]
    assert stops[0]["logical_item_id"] != stops[1]["logical_item_id"]
    assert client.post(base + "/draft").json()["data"]["id"] == trip["draft_version_id"]
    assert client.patch(base, json={"title": "New"}).status_code == 428
    headers = {"If-Match": response.headers["etag"]}
    assert client.patch(base, json={"title": "New"}, headers=headers).status_code == 200
    assert (
        client.patch(base, json={"title": "Lost update"}, headers=headers).status_code
        == 412
    )
    assert client.get(base).json()["data"]["title"] == "New"
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        identity.issuer, str(uuid4()), identity.email, identity.email_normalized
    )
    assert client.get("/api/v1/me").json()["data"]["id"] != me["id"]
    assert client.get(base).status_code == 404
    assert client.get(f"{base}/versions/{trip['draft_version_id']}").status_code == 404
    assert (
        client.patch(base, json={"title": "Steal"}, headers=headers).status_code == 404
    )
    assert client.get("/api/v1/trips").json()["data"] == []


def test_validation_and_pagination(context):
    client, db, _ = context
    for plan in [
        {"date_mode": "exact"},
        {"date_mode": "duration"},
        {"room_count": 0},
        {"stops": [{"name": "A", "timezone": "Fake/Zone"}]},
        {"budget": {"amount": "-1"}},
        {"unknown": True},
    ]:
        result = client.post("/api/v1/trips", json={"title": "Invalid", "plan": plan})
        assert result.status_code == 422
        assert result.json()["code"] == "VALIDATION_FAILED"
    ids = []
    for i in range(3):
        response = client.post("/api/v1/trips", json={"title": str(i)})
        assert response.status_code == 201, response.text
        ids.append(response.json()["data"]["id"])
    seen = []
    cursor = None
    while True:
        result = client.get(
            "/api/v1/trips",
            params={"limit": 1, **({"cursor": cursor} if cursor else {})},
        ).json()
        seen.extend(row["id"] for row in result["data"])
        cursor = result["page"]["next_cursor"]
        if not cursor:
            break
    assert set(ids) == set(seen)
    assert len(seen) == 3
    assert client.get("/api/v1/trips?cursor=broken").status_code == 400
    wrong = client.get(f"/api/v1/trips/{ids[1]}").json()["data"]["draft_version_id"]
    assert client.get(f"/api/v1/trips/{ids[0]}/versions/{wrong}").status_code == 404


def test_database_guards(context):
    client, db, _ = context
    trip = client.post("/api/v1/trips", json={"title": "Guarded"}).json()["data"]
    version = trip["draft_version_id"]
    # Clear draft pointer before a controlled test-only acceptance.
    with db.begin():
        db.execute(
            text("UPDATE trip SET draft_version_id=NULL WHERE id=:id"),
            {"id": trip["id"]},
        )
        db.execute(
            text("UPDATE plan_version SET status='accepted' WHERE id=:id"),
            {"id": version},
        )
    with pytest.raises(ProgrammingError), db.begin():
        db.execute(
            text("UPDATE plan_version SET traveler_count=99 WHERE id=:id"),
            {"id": version},
        )
    with pytest.raises(ProgrammingError), db.begin():
        db.execute(
            text(
                "INSERT INTO destination_stop(id,version_id,logical_item_id,position,name,timezone) VALUES (:id,:v,:logical,0,'Injected','UTC')"
            ),
            {"id": uuid4(), "v": version, "logical": uuid4()},
        )
    with db.begin():
        assert db.scalar(select(Trip.title).where(Trip.id == trip["id"])) == "Guarded"
        assert db.scalar(select(AppUser.id)) is not None


def test_full_draft_roundtrip_commands_and_idempotency(context):
    client, _, identity = context
    stop_a, stop_b, activity = str(uuid4()), str(uuid4()), str(uuid4())
    plan = {
        "date_mode": "duration",
        "desired_days": 45,
        "origin": {"label": "Delhi"},
        "return_location": {"label": "Mumbai"},
        "preferences": {
            "return_to_origin": False,
            "stay_preferences": {
                stop_a: {"style": "small", "rate": "4200.50", "basis": "room"}
            },
            "travel_preferences": {
                "leg": {
                    "mode": "rail",
                    "rate": "200",
                    "hours": "5.5",
                    "overnight": 0,
                    "basis": "person",
                }
            },
        },
        "stops": [
            {
                "client_id": stop_a,
                "name": "Jaipur",
                "timezone": "Asia/Kolkata",
                "desired_nights": 8,
            },
            {
                "client_id": stop_b,
                "name": "Udaipur",
                "timezone": "Asia/Kolkata",
                "desired_nights": 10,
            },
        ],
        "activities": [
            {
                "logical_id": activity,
                "stop_logical_id": stop_a,
                "user_label": "A quiet morning",
                "kind": "rest",
                "local_day_offset": 2,
                "local_start_time": "09:00",
                "duration_minutes": 60,
                "fixed": True,
            }
        ],
    }
    key = {"Idempotency-Key": str(uuid4())}
    body = {"title": "My own journey", "plan": plan}
    created = client.post("/api/v1/trips", json=body, headers=key)
    assert created.status_code == 201, created.text
    trip = created.json()["data"]
    assert (
        client.post("/api/v1/trips", json=body, headers=key).json()["data"]["id"]
        == trip["id"]
    )
    assert (
        client.post(
            "/api/v1/trips", json={**body, "title": "Different"}, headers=key
        ).status_code
        == 409
    )
    path = f"/api/v1/trips/{trip['id']}"
    vpath = f"{path}/versions/{trip['draft_version_id']}"
    version = client.get(vpath)
    assert version.json()["data"]["origin"]["label"] == "Delhi"
    assert version.json()["data"]["activities"][0]["fixed"] is True
    assert version.json()["data"]["activities"][0]["kind"] == "rest"
    assert (
        version.json()["data"]["preferences"]["stay_preferences"][stop_a]["rate"]
        == "4200.50"
    )
    reordered = [plan["stops"][1], plan["stops"][0]]
    batch = {
        "commands": [
            {"type": "stop.reorder", "stops": reordered},
            {
                "type": "activity.replace_user_schedule",
                "activities": [{**plan["activities"][0], "completed": True}],
            },
        ]
    }
    assert client.post(path + "/draft/commands", json=batch).status_code == 428
    headers = {"If-Match": version.headers["etag"]}
    changed = client.post(path + "/draft/commands", json=batch, headers=headers)
    assert changed.status_code == 200, changed.text
    assert changed.json()["data"]["activities"][0]["completed"] is True
    assert [
        s["logical_item_id"] for s in client.get(vpath + "/stops").json()["data"]
    ] == [stop_b, stop_a]
    assert (
        client.post(path + "/draft/commands", json=batch, headers=headers).status_code
        == 412
    )
    # Removing a destination with scheduled dependents requires explicit cascade.
    remove = {"commands": [{"type": "stop.reorder", "stops": [plan["stops"][1]]}]}
    assert client.post(
        path + "/draft/commands",
        json=remove,
        headers={"If-Match": changed.headers["etag"]},
    ).status_code in (409, 422)
    assert len(client.get(vpath + "/stops").json()["data"]) == 2
    # A late invalid command rolls the whole batch back, including route edits.
    invalid = {
        "commands": [
            {"type": "stop.reorder", "stops": plan["stops"]},
            {"type": "plan.update_settings", "changes": {"stops": plan["stops"]}},
        ]
    }
    assert (
        client.post(
            path + "/draft/commands",
            json=invalid,
            headers={"If-Match": changed.headers["etag"]},
        ).status_code
        == 422
    )
    assert [
        s["logical_item_id"] for s in client.get(vpath + "/stops").json()["data"]
    ] == [stop_b, stop_a]
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        identity.issuer, str(uuid4()), "other@example.org", "other@example.org"
    )
    assert (
        client.post(
            path + "/draft/commands",
            json=batch,
            headers={"If-Match": changed.headers["etag"]},
        ).status_code
        == 404
    )
