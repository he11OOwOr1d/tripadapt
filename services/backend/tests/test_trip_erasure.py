"""Permanent erasure of deleted trips after the 30 day recovery window. Destructive, so tested hard."""

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import test_planning_jobs as jobs
import test_trip_deletion as deletion
from sqlalchemy import inspect, text

from app.config import Settings, settings
from app.jobs import purge
from app.persistence.models import ConversationTurn, CreateReceipt, Trip

context = jobs.context
NOW = datetime(2026, 12, 25, 12, 0, tzinfo=timezone.utc)
DAYS = timedelta(days=1)

COUNTS = {
    "conversation_turn": "SELECT count(*) FROM conversation_turn WHERE trip_id = :t",
    "planning_job": "SELECT count(*) FROM planning_job WHERE trip_id = :t",
    "plan_proposal": "SELECT count(*) FROM plan_proposal WHERE trip_id = :t",
    "trip_create_receipt": "SELECT count(*) FROM trip_create_receipt WHERE trip_id = :t",
    "plan_version": "SELECT count(*) FROM plan_version WHERE trip_id = :t",
    "destination_stop": "SELECT count(*) FROM destination_stop WHERE version_id IN (SELECT id FROM plan_version WHERE trip_id = :t)",
    "activity": "SELECT count(*) FROM activity WHERE version_id IN (SELECT id FROM plan_version WHERE trip_id = :t)",
    "cost_item": "SELECT count(*) FROM cost_item WHERE version_id IN (SELECT id FROM plan_version WHERE trip_id = :t)",
    "trip": "SELECT count(*) FROM trip WHERE id = :t",
}


def census(db, trip_id):
    counts = {k: db.scalar(text(q), {"t": str(trip_id)}) for k, q in COUNTS.items()}
    db.commit()  # a read leaves a transaction open, which the next API call in these tests cannot start inside
    return counts


def transaction_for(db):
    @contextmanager
    def transaction():
        with db.begin_nested():
            yield db

    return transaction


def rich_trip(client, db, title="Full trip"):
    """A trip with something in every table that belongs to a trip."""
    base, trip, tag, body = jobs.setup(client)
    client.patch(
        base, json={"title": title}, headers={"If-Match": client.get(base).headers["etag"]}
    )
    path = base + f"/versions/{trip['draft_version_id']}"
    costs = [
        {
            "id": str(uuid4()),
            "category": "food",
            "label": "Dinners",
            "unit": "per_person",
            "quantity": 4,
            "amount": "12.50",
            "status": "estimated",
        }
    ]
    response = client.post(
        base + "/draft/commands",
        headers={"If-Match": client.get(path).headers["etag"]},
        json={"commands": [{"type": "cost.replace_records", "costs": costs}]},
    )
    assert response.status_code == 200, response.text
    tag = client.get(path).headers["etag"]
    jobs.create(client, base, tag, body)
    job = jobs.claim(db)
    plan, token = jobs.candidate(job), job.lease_token
    db.commit()
    assert jobs.publish(db, job.id, token, plan)
    db.commit()
    view = client.get(f"/api/v1/jobs/{job.id}").json()["data"]
    proposal = client.get(base + f"/proposals/{view['proposal_id']}").json()["data"]
    accepted = client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "expected_current_version_id": None,
            "acknowledged_issue_ids": [
                i["id"] for i in proposal["validation"]["issues"] if i["acknowledgeable"]
            ],
        },
    )
    assert accepted.status_code == 200, accepted.text
    owner = db.get(Trip, trip["id"]).owner_id
    db.add(ConversationTurn(trip_id=trip["id"], job_id=job.id, user_text="hello"))
    db.add(CreateReceipt(owner_id=owner, key=uuid4(), fingerprint="f" * 64, trip_id=trip["id"]))
    db.commit()
    return trip["id"], base


def delete_and_age(client, db, trip_id, base, days_ago):
    etag = client.get(base).headers["etag"]
    assert deletion.delete(client, trip_id, etag).status_code == 202
    db.execute(
        text("UPDATE trip SET deleted_at = :at WHERE id = :t"),
        {"at": NOW - timedelta(days=days_ago), "t": str(trip_id)},
    )
    db.commit()


def test_the_fixture_really_fills_every_table_that_belongs_to_a_trip(context):
    client, db, _ = context
    trip_id, _ = rich_trip(client, db)
    counts = census(db, trip_id)
    assert all(n > 0 for n in counts.values()), counts
    assert counts["plan_version"] >= 2  # a draft and an accepted version, linked as parent and child


def test_an_expired_trip_is_erased_from_every_table(context):
    client, db, _ = context
    trip_id, base = rich_trip(client, db)
    delete_and_age(client, db, trip_id, base, days_ago=31)
    results = purge.erase_expired_trips(transaction_for(db), now=NOW)
    db.commit()
    assert [str(r.trip_id) for r in results] == [str(trip_id)] and results[0].erased
    assert census(db, trip_id) == {k: 0 for k in COUNTS}
    # the report says what went, without saying what was in it
    assert set(results[0].rows) == set(purge.OWNED_TABLES) | {"trip"}
    assert results[0].rows["trip"] == 1 and results[0].rows["conversation_turn"] == 1


def test_the_recovery_window_is_exact_to_the_second(context):
    client, db, _ = context
    inside, base_in = rich_trip(client, db, "Inside")
    delete_and_age(client, db, inside, base_in, days_ago=29)
    on_the_line, base_on = rich_trip(client, db, "On the line")
    etag = client.get(base_on).headers["etag"]
    assert deletion.delete(client, on_the_line, etag).status_code == 202
    db.execute(text("UPDATE trip SET deleted_at = :at WHERE id = :t"), {"at": NOW - 30 * DAYS, "t": str(on_the_line)})
    db.commit()
    just_past, base_past = rich_trip(client, db, "Just past")
    etag = client.get(base_past).headers["etag"]
    assert deletion.delete(client, just_past, etag).status_code == 202
    db.execute(text("UPDATE trip SET deleted_at = :at WHERE id = :t"), {"at": NOW - 30 * DAYS - timedelta(seconds=1), "t": str(just_past)})
    db.commit()
    erased = {str(r.trip_id) for r in purge.erase_expired_trips(transaction_for(db), now=NOW)}
    db.commit()
    assert erased == {str(just_past)}
    assert census(db, inside)["trip"] == 1 and census(db, on_the_line)["trip"] == 1
    assert census(db, just_past)["trip"] == 0


def test_a_trip_that_was_never_deleted_is_never_erased_however_old(context):
    client, db, _ = context
    trip_id, _ = rich_trip(client, db)
    before = census(db, trip_id)
    db.execute(text("UPDATE trip SET created_at = :old, updated_at = :old WHERE id = :t"), {"old": NOW - 4000 * DAYS, "t": str(trip_id)})
    db.commit()
    assert purge.erase_expired_trips(transaction_for(db), now=NOW + 4000 * DAYS) == []
    db.commit()
    assert census(db, trip_id) == before


def test_other_trips_are_untouched_and_still_served(context):
    client, db, _ = context
    keep_id, keep_base = rich_trip(client, db, "Keep me")
    doomed, base = rich_trip(client, db, "Doomed")
    before = census(db, keep_id)
    delete_and_age(client, db, doomed, base, days_ago=40)
    purge.erase_expired_trips(transaction_for(db), now=NOW)
    db.commit()
    assert census(db, keep_id) == before
    assert client.get(keep_base).status_code == 200
    assert client.get(base).status_code == 404


def test_a_dry_run_reports_what_it_would_erase_and_changes_nothing(context):
    client, db, _ = context
    trip_id, base = rich_trip(client, db)
    delete_and_age(client, db, trip_id, base, days_ago=31)
    before = census(db, trip_id)
    results = purge.erase_expired_trips(transaction_for(db), now=NOW, dry_run=True)
    db.commit()
    assert len(results) == 1 and not results[0].erased
    assert results[0].rows == {k: v for k, v in before.items()}
    assert census(db, trip_id) == before


def test_a_batch_limit_is_respected_and_the_rest_wait_for_the_next_run(context):
    client, db, _ = context
    ids = []
    for n in range(3):
        trip_id, base = rich_trip(client, db, f"T{n}")
        delete_and_age(client, db, trip_id, base, days_ago=35 + n)
        ids.append(str(trip_id))
    first = purge.erase_expired_trips(transaction_for(db), now=NOW, limit=2)
    db.commit()
    assert len(first) == 2
    second = purge.erase_expired_trips(transaction_for(db), now=NOW, limit=2)
    db.commit()
    assert len(second) == 1
    assert {str(r.trip_id) for r in first + second} == set(ids)
    assert purge.erase_expired_trips(transaction_for(db), now=NOW) == []


def test_a_failure_part_way_through_leaves_that_trip_whole_and_does_not_stop_the_others(context, monkeypatch):
    client, db, _ = context
    bad, base_bad = rich_trip(client, db, "Fails")
    good, base_good = rich_trip(client, db, "Works")
    delete_and_age(client, db, bad, base_bad, days_ago=50)
    delete_and_age(client, db, good, base_good, days_ago=40)
    before = census(db, bad)
    real = purge._remove_trip_row

    def sometimes_breaks(db_, trip):
        if str(trip.id) == str(bad):
            raise RuntimeError("disk on fire")
        return real(db_, trip)

    monkeypatch.setattr(purge, "_remove_trip_row", sometimes_breaks)
    results = purge.erase_expired_trips(transaction_for(db), now=NOW)
    db.commit()
    by_id = {str(r.trip_id): r for r in results}
    assert not by_id[str(bad)].erased and by_id[str(bad)].error == "RuntimeError"
    assert by_id[str(good)].erased
    # everything done to the failed trip before the failure was rolled back with it
    assert census(db, bad) == before
    assert census(db, good) == {k: 0 for k in COUNTS}
    # and it is tried again, successfully, on the next run
    monkeypatch.setattr(purge, "_remove_trip_row", real)
    assert [str(r.trip_id) for r in purge.erase_expired_trips(transaction_for(db), now=NOW)] == [str(bad)]
    db.commit()
    assert census(db, bad) == {k: 0 for k in COUNTS}


def test_the_erase_list_matches_every_table_that_belongs_to_a_trip(context):
    """If a new table ever points at a trip, this fails until erasure learns about it, instead of silently keeping data."""
    _, db, _ = context
    inspector = inspect(db.connection())
    tables = inspector.get_table_names()
    references = {t: {fk["referred_table"] for fk in inspector.get_foreign_keys(t)} for t in tables}
    owned = {"trip"}
    while True:
        more = {t for t in tables if t not in owned and references[t] & owned}
        if not more:
            break
        owned |= more
    assert owned - {"trip"} == set(purge.OWNED_TABLES)
    # shared snapshots are never erased with a trip
    assert {"place_reference", "discovered_place", "app_user"}.isdisjoint(owned)


def test_shared_place_snapshots_and_users_survive_an_erasure(context):
    client, db, _ = context
    trip_id, base = rich_trip(client, db)
    shared = {t: db.scalar(text(f"SELECT count(*) FROM {t}")) for t in ("app_user", "place_reference", "discovered_place")}
    db.commit()
    delete_and_age(client, db, trip_id, base, days_ago=31)
    purge.erase_expired_trips(transaction_for(db), now=NOW)
    db.commit()
    assert {t: db.scalar(text(f"SELECT count(*) FROM {t}")) for t in shared} == shared
    assert shared["app_user"] >= 1


def test_a_retention_shorter_than_a_day_is_refused_so_nothing_is_erased_by_mistake(context):
    _, db, _ = context
    for days in (0, -5):
        with pytest.raises(ValueError):
            purge.erase_expired_trips(transaction_for(db), now=NOW, retention_days=days)
    with pytest.raises(ValueError):
        Settings(trip_retention_days=0)
    assert settings.trip_retention_days == 30


def test_the_delete_answer_says_when_the_trip_will_be_erased(context):
    client, db, _ = context
    trip, etag = deletion.make_trip(client)
    answer = deletion.delete(client, trip["id"], etag).json()["data"]
    deleted = datetime.fromisoformat(answer["deleted_at"])
    assert datetime.fromisoformat(answer["erase_after"]) - deleted == timedelta(days=settings.trip_retention_days)


def test_the_worker_cleans_up_on_a_timer_and_a_failure_does_not_stop_it(monkeypatch):
    from app.jobs.service import WebServiceWorker

    calls = []
    clock = {"now": 1000.0}
    monkeypatch.setattr("app.jobs.service.monotonic", lambda: clock["now"])
    monkeypatch.setattr(purge, "purge_job", lambda: calls.append(clock["now"]) or [])
    monkeypatch.setattr("app.jobs.service.purge_job", purge.purge_job, raising=False)
    monkeypatch.setattr(settings, "trip_purge_enabled", True)
    monkeypatch.setattr(settings, "trip_purge_interval_minutes", 60)
    worker = WebServiceWorker()
    worker.maybe_purge()
    assert calls == []  # not in the first moments after starting
    clock["now"] += 200
    worker.maybe_purge()
    worker.maybe_purge()
    assert len(calls) == 1  # once, then not again until the interval has passed
    clock["now"] += 3599
    worker.maybe_purge()
    assert len(calls) == 1
    clock["now"] += 2
    monkeypatch.setattr("app.jobs.service.purge_job", lambda: (_ for _ in ()).throw(RuntimeError("db down")))
    worker.maybe_purge()  # a failure is swallowed and retried later
    clock["now"] += 3601
    monkeypatch.setattr("app.jobs.service.purge_job", lambda: calls.append(clock["now"]) or [])
    worker.maybe_purge()
    assert len(calls) == 2
    monkeypatch.setattr(settings, "trip_purge_enabled", False)
    clock["now"] += 10_000
    worker.maybe_purge()
    assert len(calls) == 2


def declare(db, trip_id):
    db.execute(text("SELECT set_config('app.erasing_trip', :t, true)"), {"t": str(trip_id) if trip_id else ""})


def accepted_version(db, trip_id):
    return db.scalar(text("SELECT id FROM plan_version WHERE trip_id = :t AND status = 'accepted'"), {"t": str(trip_id)})


def refused(db, sql, params):
    """The statement must be rejected by the database, and rejecting it must not poison later statements."""
    with pytest.raises(Exception, match="immutable"):
        with db.begin_nested():
            db.execute(text(sql), params)


def test_accepted_plans_stay_protected_except_for_the_one_trip_being_erased(context):
    client, db, _ = context
    mine, _ = rich_trip(client, db, "Mine")
    other, _ = rich_trip(client, db, "Other")
    mine_v, other_v = accepted_version(db, mine), accepted_version(db, other)
    kill_version = "DELETE FROM plan_version WHERE id = :v"
    # no declaration: refused, for the version and for each kind of row under it
    refused(db, kill_version, {"v": str(mine_v)})
    for table in ("activity", "destination_stop", "cost_item"):
        refused(db, f"DELETE FROM {table} WHERE version_id = :v", {"v": str(mine_v)})
    refused(db, "UPDATE plan_version SET traveler_count = 9 WHERE id = :v", {"v": str(mine_v)})
    # a declaration for another trip, or for no trip, opens nothing
    declare(db, other)
    refused(db, kill_version, {"v": str(mine_v)})
    refused(db, "DELETE FROM activity WHERE version_id = :v", {"v": str(mine_v)})
    declare(db, "")
    refused(db, kill_version, {"v": str(mine_v)})
    # even the right declaration allows only deleting, never changing, an accepted plan
    declare(db, mine)
    refused(db, "UPDATE plan_version SET traveler_count = 9 WHERE id = :v", {"v": str(mine_v)})
    refused(db, "UPDATE activity SET duration_minutes = 5 WHERE version_id = :v", {"v": str(mine_v)})
    refused(db, kill_version, {"v": str(other_v)})
    declare(db, "")
    assert census(db, mine)["plan_version"] >= 2 and census(db, other)["plan_version"] >= 2


def test_the_permission_to_erase_does_not_outlive_the_erasure(context):
    client, db, _ = context
    trip_id, base = rich_trip(client, db)
    other, _ = rich_trip(client, db, "Other")
    delete_and_age(client, db, trip_id, base, days_ago=31)
    purge.erase_expired_trips(transaction_for(db), now=NOW)
    assert db.scalar(text("SELECT coalesce(current_setting('app.erasing_trip', true), '')")) == ""
    refused(db, "DELETE FROM plan_version WHERE id = :v", {"v": str(accepted_version(db, other))})
