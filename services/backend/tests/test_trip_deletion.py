"""FR-11: a traveler can delete a trip. It disappears at once, nothing can act on it, and its planning jobs stop."""

import re
from uuid import uuid4

import test_planning_jobs as jobs

from app.api.identity import TrustedIdentity, verified_identity
from app.main import app
from app.persistence.models import PlanningJob, Trip

context = jobs.context


def dummy(schema):
    """A plausible value for a required query parameter, so validation does not answer before the deletion check."""
    if "enum" in schema:
        return schema["enum"][0]
    kind, form = schema.get("type"), schema.get("format")
    if form == "uuid":
        return str(uuid4())
    if form == "date":
        return "2026-12-04"
    if kind == "integer":
        return schema.get("minimum", 0)
    return "x"


def make_trip(client, title="Doomed"):
    response = client.post("/api/v1/trips", json={"title": title})
    assert response.status_code == 201, response.text
    return response.json()["data"], response.headers["etag"]


def delete(client, trip_id, etag=None):
    headers = {"If-Match": etag} if etag else {}
    return client.delete(f"/api/v1/trips/{trip_id}", headers=headers)


def test_delete_needs_the_current_version_of_the_trip(context):
    client, db, _ = context
    trip, etag = make_trip(client)
    assert delete(client, trip["id"]).status_code == 428
    assert delete(client, trip["id"], '"trip:wrong:0"').status_code == 412
    # a change made elsewhere since this etag was read must not be deleted blind
    assert (
        client.patch(
            f"/api/v1/trips/{trip['id']}", json={"title": "Changed"}, headers={"If-Match": etag}
        ).status_code
        == 200
    )
    assert delete(client, trip["id"], etag).status_code == 412
    assert client.get(f"/api/v1/trips/{trip['id']}").status_code == 200


def test_a_deleted_trip_is_gone_from_reads_and_the_list(context):
    client, db, _ = context
    keep, _ = make_trip(client, "Keep")
    trip, etag = make_trip(client, "Doomed")
    response = delete(client, trip["id"], etag)
    assert response.status_code == 202, response.text
    body = response.json()["data"]
    assert body["id"] == trip["id"] and body["deleted_at"]
    base = f"/api/v1/trips/{trip['id']}"
    assert client.get(base).status_code == 404
    assert client.get(f"{base}/versions/{trip['draft_version_id']}").status_code == 404
    assert client.get(f"{base}/versions/{trip['draft_version_id']}/stops").status_code == 404
    assert client.patch(base, json={"title": "x"}, headers={"If-Match": etag}).status_code == 404
    listed = [t["id"] for t in client.get("/api/v1/trips").json()["data"]]
    assert listed == [keep["id"]]
    # the other trip is untouched
    assert client.get(f"/api/v1/trips/{keep['id']}").status_code == 200


def test_the_data_is_hidden_not_purged_and_deleting_twice_is_not_found(context):
    client, db, _ = context
    trip, etag = make_trip(client)
    assert delete(client, trip["id"], etag).status_code == 202
    row = db.get(Trip, trip["id"])
    # Only hidden: a later cleanup job is not built yet, and the response says nothing more than it did.
    assert row is not None and row.deleted_at is not None
    db.commit()
    assert delete(client, trip["id"], etag).status_code == 404


def test_another_traveler_cannot_delete_a_trip(context):
    client, db, identity = context
    trip, etag = make_trip(client)
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        identity.issuer, str(uuid4()), "other@example.org", "other@example.org"
    )
    assert client.get("/api/v1/me").status_code == 200
    assert delete(client, trip["id"], etag).status_code == 404
    app.dependency_overrides[verified_identity] = lambda: identity
    assert client.get(f"/api/v1/trips/{trip['id']}").status_code == 200
    assert db.get(Trip, trip["id"]).deleted_at is None
    db.commit()


def test_deleting_a_trip_stops_its_planning_jobs(context):
    client, db, _ = context
    base, trip, tag, body = jobs.setup(client)
    queued = jobs.create(client, base, tag, body).json()["data"]
    etag = client.get(base).headers["etag"]
    # a queued job is cancelled outright and can never be claimed
    assert delete(client, trip["id"], etag).status_code == 202
    row = db.get(PlanningJob, queued["id"])
    assert row.status == "cancelled" and row.cancel_requested
    db.commit()
    assert jobs.claim(db) is None


def test_a_job_already_running_is_told_to_stop_and_never_publishes(context):
    client, db, _ = context
    base, trip, tag, body = jobs.setup(client)
    jobs.create(client, base, tag, body)
    job = jobs.claim(db)
    plan, token = jobs.candidate(job), job.lease_token
    db.commit()
    etag = client.get(base).headers["etag"]
    assert delete(client, trip["id"], etag).status_code == 202
    db.refresh(job)
    assert job.cancel_requested
    assert not jobs.publish(db, job.id, token, plan)
    assert job.proposal_id is None and job.status in ("cancelled", "superseded")
    db.commit()
    # nothing the finished job leaves behind is reachable
    assert client.get(f"/api/v1/jobs/{job.id}").status_code == 404


def test_finished_jobs_are_left_as_they_were(context):
    client, db, _ = context
    base, trip, tag, body = jobs.setup(client)
    jobs.create(client, base, tag, body)
    job = jobs.claim(db)
    plan, token = jobs.candidate(job), job.lease_token
    db.commit()
    assert jobs.publish(db, job.id, token, plan)
    db.commit()
    assert job.status == "succeeded"
    etag = client.get(base).headers["etag"]
    assert delete(client, trip["id"], etag).status_code == 202
    db.refresh(job)
    assert job.status == "succeeded" and not job.cancel_requested


def test_no_route_that_takes_a_trip_succeeds_for_a_deleted_trip(context):
    """Walk the whole API: every path with a trip id, every method. A route that forgot to check deletion would show here."""
    client, db, _ = context
    base, trip, tag, body = jobs.setup(client)
    jobs.create(client, base, tag, body)
    etag = client.get(base).headers["etag"]
    assert delete(client, trip["id"], etag).status_code == 202
    db.commit()
    spec = app.openapi()
    checked = []
    for path, methods in spec["paths"].items():
        if "{trip_id}" not in path:
            continue
        for method in methods:
            if method not in ("get", "post", "put", "patch", "delete"):
                continue
            url = re.sub(r"\{trip_id\}", trip["id"], path)
            url = re.sub(r"\{[a-z_]+\}", str(uuid4()), url)
            headers = {"If-Match": '"x"', "Idempotency-Key": str(uuid4())}
            query = {
                p["name"]: dummy(p.get("schema", {}))
                for p in methods[method].get("parameters", [])
                if p.get("in") == "query" and p.get("required")
            }
            response = client.request(
                method.upper(), url, params=query, json={} if method != "get" else None, headers=headers
            )
            checked.append((method.upper(), path, response.status_code))
            assert 400 <= response.status_code < 500, (method, path, response.status_code, response.text[:200])
            if method == "get":
                # a read has no body to reject first, so it must be the deletion check that answered
                assert response.status_code == 404, (method, path, response.status_code, response.text[:200])
    # the walk really covered the API: if routes are renamed this test must be revisited, not silently emptied
    assert len(checked) >= 25, checked
    assert any(m == "GET" for m, _, _ in checked) and any(m == "POST" for m, _, _ in checked)


def test_create_replay_for_a_deleted_trip_is_not_found_rather_than_an_error(context):
    client, db, _ = context
    key = str(uuid4())
    payload = {"title": "Replay"}
    first = client.post("/api/v1/trips", json=payload, headers={"Idempotency-Key": key})
    assert first.status_code == 201
    trip = first.json()["data"]
    assert delete(client, trip["id"], first.headers["etag"]).status_code == 202
    replay = client.post("/api/v1/trips", json=payload, headers={"Idempotency-Key": key})
    assert replay.status_code in (404, 409), replay.text
    assert replay.status_code < 500


def test_a_browser_may_send_delete_from_the_web_app(context):
    """The browser asks first (a CORS preflight). The test client skips that check, so it must be tested on its own."""
    client, _, _ = context
    url = "/api/v1/trips/" + str(uuid4())
    ask = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "DELETE",
        "Access-Control-Request-Headers": "authorization,if-match,content-type",
    }
    answer = client.options(url, headers=ask)
    assert answer.status_code == 200, answer.text
    assert "DELETE" in answer.headers["access-control-allow-methods"]
    assert answer.headers["access-control-allow-origin"] == "http://localhost:3000"
    # a page from anywhere else is still refused, and so is a method the API does not offer
    assert client.options(url, headers={**ask, "Origin": "https://evil.example"}).status_code == 400
    assert client.options(url, headers={**ask, "Access-Control-Request-Method": "PUT"}).status_code == 400
