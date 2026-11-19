from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
import test_activity_discovery
import test_conversation
import test_weather_chat
import test_weather_revisions
from sqlalchemy import select

from app.agents.conversation import respond
from app.api import places
from app.api.identity import TrustedIdentity, verified_identity
from app.api.proposals import plan_input
from app.config import settings
from app.jobs.worker import claim, publish_reply
from app.main import app
from app.persistence.models import Activity, AppUser, PlanVersion, Trip
from app.planning.chat_options import rank_replacements
from app.providers.activities import ActivityDiscovery, DiscoveryFailure
from app.providers.weather import WeatherFailure
from app.trips.schemas import PlanInput


@pytest.fixture
def context(monkeypatch):
    yield from test_conversation.context.__wrapped__(monkeypatch)


def setup(client, db, identity, monkeypatch, exact=False):
    base, version, trip, tag, body, weather_calls, state = test_weather_revisions.setup(
        client, monkeypatch, exact=exact
    )
    plan = plan_input(db, db.get(PlanVersion, UUID(trip["draft_version_id"])))
    scope = dict(
        type="selected_day", stop_logical_id=plan.stops[0].client_id, local_day_offset=0
    )
    db.commit()
    message = dict(
        text="Find a museum alternative to Walk",
        evidence="places",
        base_version_id=trip["draft_version_id"],
        scope=scope,
    )
    response = test_conversation.send(client, base, tag, message)
    turn = response.json()["data"]
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    reply = respond(
        PlanInput.model_validate(job.input["plan"]),
        scope,
        message["text"],
        [],
        test_weather_chat.ReplacementProvider(body["activity_id"]),
        evidence="places",
    )
    assert publish_reply(db, job.id, job.lease_token, reply)
    db.commit()
    calls = []

    def discover(lat, lon, category):
        calls.append((lat, lon, category))
        return {
            "elements": [
                test_activity_discovery.museum(
                    id=i + 1,
                    lat=35.02 + i * 0.001,
                    tags={"name": f"Place {i}", "tourism": category},
                )
                for i in reversed(range(5))
            ]
        }

    monkeypatch.setattr(settings, "activity_search_enabled", True)
    monkeypatch.setattr(places, "activity_discovery", ActivityDiscovery(discover))
    url = base + f"/messages/{turn['id']}/replacement-options"
    return (
        url,
        base,
        version,
        trip,
        tag,
        dict(visit_date=body["visit_date"], category="museum"),
        calls,
        weather_calls,
        state,
    )


def lookup(client, url, tag, body):
    return client.post(url, headers={"If-Match": tag}, json=body)


def test_research_returns_bounded_real_records_and_preserves_the_draft(
    context, monkeypatch
):
    client, db, identity = context
    url, base, version, _, tag, body, calls, _, _ = setup(
        client, db, identity, monkeypatch
    )
    original = client.get(version).json()["data"]
    response = lookup(client, url, tag, body)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert response.headers["cache-control"] == "private, no-store"
    assert data["base_etag"] == tag and data["forecast"]["status"] == "forecast"
    assert data["target"]["label"] == "Walk" and data["target"]["start"] == "10:00"
    assert len(data["options"]) == 3 and data["eligible_count"] == 5
    assert [o["place"]["name"] for o in data["options"]] == [
        "Place 0",
        "Place 1",
        "Place 2",
    ]
    assert all(o["distance_basis"] == "destination_centre" for o in data["options"])
    assert calls[0][2] == "museum"
    assert client.get(version).json()["data"] == original
    assert client.get(version).headers["etag"] == tag
    assert client.get(base + "/proposals").json()["data"]["reviews"] == []
    other = lookup(client, url, tag, {**body, "category": "gallery"})
    assert other.status_code == 200 and all(
        o["place"]["category"] == "gallery" for o in other.json()["data"]["options"]
    )


@pytest.mark.parametrize("case", ["outage", "quota", "distant", "missing"])
def test_no_usable_forecast_never_searches_for_places(context, monkeypatch, case):
    client, db, identity = context
    url, _, _, _, tag, body, calls, _, state = setup(client, db, identity, monkeypatch)
    if case == "outage":
        state.failure = WeatherFailure()
    if case == "quota":
        state.failure = WeatherFailure("WEATHER_RATE_LIMITED", 429)
    if case == "distant":
        body["visit_date"] = "2099-01-01"
    if case == "missing":
        state.covered = False
    response = lookup(client, url, tag, body)
    assert response.status_code == (
        503 if case == "outage" else 429 if case == "quota" else 200
    ), response.text
    if response.status_code == 200:
        assert response.json()["data"]["options"] == []
    assert not calls


def test_discovery_failure_is_explicit_and_retained_fallback_is_labeled(
    context, monkeypatch
):
    client, db, identity = context
    url, _, _, _, tag, body, _, _, _ = setup(client, db, identity, monkeypatch)

    def broken(*args):
        raise DiscoveryFailure("ACTIVITY_PROVIDER_UNAVAILABLE")

    provider = places.activity_discovery
    monkeypatch.setattr(places, "activity_discovery", ActivityDiscovery(broken))
    assert lookup(client, url, tag, body).status_code == 503
    monkeypatch.setattr(places, "activity_discovery", provider)
    assert lookup(client, url, tag, body).status_code == 200
    monkeypatch.setattr(places, "activity_discovery", ActivityDiscovery(broken))
    response = lookup(client, url, tag, body)
    assert response.status_code == 200, response.text
    assert "retained" in response.json()["data"]["notice"]


@pytest.mark.parametrize("flag", ["fixed", "booked", "completed"])
def test_invalidated_targets_are_blocked_before_lookup(context, monkeypatch, flag):
    client, db, identity = context
    url, _, _, trip, tag, body, calls, weather_calls, _ = setup(
        client, db, identity, monkeypatch
    )
    target = db.scalar(
        select(Activity).where(
            Activity.version_id == UUID(trip["draft_version_id"]),
            Activity.user_label == "Walk",
        )
    )
    setattr(target, flag, True)
    db.commit()
    assert lookup(client, url, tag, body).status_code == 409
    assert not calls and not weather_calls


def test_staleness_exact_dates_and_lifecycle_are_checked_before_providers(
    context, monkeypatch
):
    client, db, identity = context
    url, _, _, trip, tag, body, calls, weather_calls, _ = setup(
        client, db, identity, monkeypatch, exact=True
    )
    assert client.post(url, json=body).status_code == 428
    assert (
        lookup(client, url, tag, {**body, "visit_date": "2099-01-01"}).status_code
        == 409
    )
    assert lookup(client, url, tag, {**body, "category": "park"}).status_code == 422
    row = db.get(Trip, UUID(trip["id"]))
    row.lifecycle = "active"
    db.commit()
    assert lookup(client, url, tag, body).status_code == 409
    row.lifecycle = "planning"
    draft = db.get(PlanVersion, UUID(trip["draft_version_id"]))
    draft.edit_sequence += 1
    db.commit()
    assert lookup(client, url, tag, body).status_code == 412
    updated = f'"draft:{draft.id}:{draft.edit_sequence}"'
    db.commit()
    assert lookup(client, url, updated, body).status_code == 409
    assert not calls and not weather_calls


def test_ownership_and_edits_during_research_cannot_return_stale_choices(
    context, monkeypatch
):
    client, db, identity = context
    url, _, _, trip, tag, body, _, _, _ = setup(client, db, identity, monkeypatch)
    original = places.search_places

    def changing(*args):
        result = original(*args)
        draft = db.get(PlanVersion, UUID(trip["draft_version_id"]))
        draft.edit_sequence += 1
        db.flush()
        return result

    monkeypatch.setattr(places, "search_places", changing)
    response = lookup(client, url, tag, body)
    assert (
        response.status_code == 409
        and response.json()["code"] == "WEATHER_REQUEST_UNAVAILABLE"
    )
    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "test-issuer", str(uuid4()), "other@example.org", "other@example.org"
    )
    assert lookup(client, url, tag, body).status_code == 404
    app.dependency_overrides.pop(verified_identity)
    assert lookup(client, url, tag, body).status_code == 401


def test_ranking_uses_current_location_and_filters_unknown_old_duplicate_and_current_records():
    stamp = datetime.now(timezone.utc)
    ref = SimpleNamespace(id="ref", payload={"latitude": 0, "longitude": 0})

    def place(id, external, lat=0, **extra):
        return SimpleNamespace(
            id=id,
            external_id=external,
            latitude=lat,
            longitude=0,
            name=id,
            category="museum",
            destination_reference_id="ref",
            retrieved_at=stamp,
            **extra,
        )

    current = place("current", "node/1", 0.01)
    nearby = place("near", "node/2", 0.011)
    old = place("old", "node/3")
    old.retrieved_at -= timedelta(hours=25)
    foreign = place("foreign", "node/4")
    foreign.destination_reference_id = "other"
    results, count = rank_replacements(
        [current, place("far", "node/5", 0), nearby, nearby, old, foreign],
        current,
        ref,
        "museum",
        stamp,
    )
    assert count == 2 and results[0]["place"] == nearby
    assert all(o["distance_basis"] == "activity_location" for o in results)


def test_selected_chat_option_uses_existing_review_and_acceptance_boundary(
    context, monkeypatch
):
    import test_time_change_proposals

    client, db, identity = context
    url, base, version, _, tag, body, _, _, _ = setup(client, db, identity, monkeypatch)
    original = client.get(version).json()["data"]
    result = lookup(client, url, tag, body).json()["data"]
    selected = result["options"][0]["place"]
    response = test_weather_revisions.propose(
        client,
        base,
        tag,
        {
            "activity_id": result["target"]["activity_id"],
            "visit_date": body["visit_date"],
            "intent": "replace_place",
            "replacement_place_id": selected["id"],
        },
    )
    assert response.status_code == 201, response.text
    proposal = response.json()["data"]
    assert proposal["generation"]["replacement"]["after"] == selected["name"]
    assert client.get(version).json()["data"] == original
    accepted = test_time_change_proposals.accept(client, base, proposal)
    assert accepted.status_code == 200, accepted.text
    changed = client.get(version).json()["data"]
    target = next(
        a
        for a in changed["activities"]
        if a["logical_id"] == result["target"]["activity_id"]
    )
    assert (
        target["place_id"] == selected["id"]
        and target["local_start_time"] == "10:00:00"
    )
    assert target["duration_minutes"] == 60
    assert [
        a for a in changed["activities"] if a["logical_id"] != target["logical_id"]
    ] == [a for a in original["activities"] if a["logical_id"] != target["logical_id"]]
    assert lookup(client, url, tag, body).status_code == 412


def test_shortlist_diversifies_names_without_merging_source_identities():
    stamp = datetime.now(timezone.utc)
    ref = SimpleNamespace(id="ref", payload={"latitude": 0, "longitude": 0})
    rows = [
        SimpleNamespace(
            id=str(i),
            external_id=f"node/{i + 1}",
            latitude=i * 0.001,
            longitude=0,
            name=name,
            category="museum",
            destination_reference_id="ref",
            retrieved_at=stamp,
        )
        for i, name in enumerate(
            ["Museum", " museum ", "Gallery building", "Local collection"]
        )
    ]
    options, count = rank_replacements(rows, None, ref, "museum", stamp)
    assert count == 4 and len(options) == 3
    assert options[0]["place"].external_id == "node/1"
    assert [o["place"].name for o in options] == [
        "Museum",
        "Gallery building",
        "Local collection",
    ]
    assert rows[1].external_id == "node/2"
