from datetime import datetime, timezone
from uuid import uuid4

import pytest
from test_replanning import inputs

from app.planning.remaining_day import (
    PreviewConflict,
    RemainingDayInput,
    remaining_day_preview,
)


def fixture():
    plan, body, now = inputs()
    for a in plan.activities:
        a.place_id = uuid4()
        if a.user_label in ("Past", "Ongoing"):
            a.completed = True
    # Make both upcoming items flexible so one late route can propagate.
    plan.activities[3].booked = False
    body = RemainingDayInput(**body.model_dump(), mode="WALK", buffer_minutes=10)
    return plan, body, now


def test_route_from_reported_location_and_all_connections_preserves_original():
    plan, body, now = fixture()
    before = plan.model_dump()
    calls = []

    def estimate(origin, destination):
        calls.append((origin, destination))
        return 60

    result = remaining_day_preview(plan, body, now, estimate)
    assert plan.model_dump() == before
    assert calls == [
        (body.current_location_place_id, plan.activities[3].place_id),
        (plan.activities[3].place_id, plan.activities[4].place_id),
    ]
    assert [c["after"] for c in result["changes"]] == ["11:25", "13:05"]
    assert all(c["duration_minutes"] == 30 for c in result["changes"])


def test_commitment_is_never_moved_and_no_partial_preview_escapes():
    plan, body, now = fixture()
    plan.activities[4].fixed = True
    with pytest.raises(PreviewConflict) as error:
        remaining_day_preview(plan, body, now, lambda *_: 60)
    assert error.value.code == "REPLAN_COMMITMENT_CONFLICT"
    assert plan.activities[3].local_start_time.strftime("%H:%M") == "11:00"


def test_no_earlier_moves_and_actual_clock_rounds_forward():
    plan, body, now = fixture()
    result = remaining_day_preview(plan, body, now, lambda *_: 0)
    assert result["unchanged"]
    # At 10:55:01 the first arrival is rounded to 11:06, never 11:05.
    body = body.model_copy(update={"local_time": "10:55"})
    now = datetime(2026, 11, 14, 5, 25, 1, tzinfo=timezone.utc)
    result = remaining_day_preview(plan, body, now, lambda *_: 0)
    assert result["changes"][0]["after"] == "11:06"


@pytest.mark.parametrize("failure", ["map", "status", "midnight", "route"])
def test_fail_closed(failure):
    plan, body, now = fixture()
    if failure == "map":
        plan.activities[4].place_id = None
    if failure == "status":
        plan.activities[0].completed = False
    minutes = 900 if failure == "midnight" else -1 if failure == "route" else 0
    with pytest.raises(PreviewConflict):
        remaining_day_preview(plan, body, now, lambda *_: minutes)


@pytest.fixture
def context():
    import test_trips

    yield from test_trips.context.__wrapped__()


def test_owned_endpoint_checks_real_sources_and_provider_warnings(context, monkeypatch):
    from types import SimpleNamespace
    from uuid import UUID
    from zoneinfo import ZoneInfo

    import test_place_references
    from sqlalchemy import func, select

    from app.api import journeys, replanning
    from app.persistence.models import DiscoveredPlace, PlanVersion
    from app.providers.geoapify_checks import RouteEstimate

    client, db, _ = context
    plan, body, _ = fixture()
    reference = test_place_references.selected(client, monkeypatch)
    stop = plan.stops[0]
    stop.name = reference["label"]
    stop.timezone = reference["timezone"]
    stop.place_reference_id = UUID(reference["reference_id"])
    now = datetime(2026, 11, 14, 10, 15, tzinfo=ZoneInfo(stop.timezone)).astimezone(
        timezone.utc
    )
    monkeypatch.setattr(replanning, "current_time", lambda: now)
    places = []
    for i in range(3):
        place = DiscoveredPlace(
            id=uuid4(),
            destination_reference_id=stop.place_reference_id,
            payload=dict(
                external_id=f"node/{i + 1}",
                name=f"Place {i}",
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
    plan.activities[3].place_id = places[1]
    plan.activities[4].place_id = places[2]
    # Completed activities do not need routing links for this operation.
    for a in plan.activities[:3]:
        a.place_id = None
    trip = client.post(
        "/api/v1/trips",
        json={"title": "Preview QA", "plan": plan.model_dump(mode="json")},
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}/replanning"
    ctx = client.get(
        base + "/context",
        params=dict(basis="draft", stop_id=str(body.stop_id), local_day_offset=12),
    ).json()["data"]
    payload = {
        **body.model_dump(mode="json"),
        "base_version_id": ctx["base_version_id"],
        "utc_offset_minutes": ctx["utc_offset_minutes"],
        "current_location_place_id": str(places[0]),
    }
    calls = []
    state = {"warnings": []}

    def route(*args, **kwargs):
        calls.append((args, kwargs))
        return RouteEstimate(60, 2000, state["warnings"])

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=route))
    before = db.scalar(select(func.count()).select_from(PlanVersion))
    db.commit()
    assert client.post(base + "/preview", json=payload).status_code == 428
    assert (
        client.post(
            base + "/preview", json=payload, headers={"If-Match": "old"}
        ).json()["code"]
        == "REPLAN_BASE_CHANGED"
    )
    response = client.post(
        base + "/preview", json=payload, headers={"If-Match": ctx["base_etag"]}
    )
    assert response.status_code == 200, response.text
    result = response.json()["data"]
    assert [a["after"] for a in result["changes"]] == ["11:25", "13:05"]
    assert len(calls) == 2 and all(call[0][1] == "WALK" for call in calls)
    assert calls[0][0][2][0] == 35.02
    assert db.scalar(select(func.count()).select_from(PlanVersion)) == before
    db.commit()
    state["warnings"] = ["Restricted road"]
    failed = client.post(
        base + "/preview", json=payload, headers={"If-Match": ctx["base_etag"]}
    )
    assert failed.status_code == 409 and failed.json()["code"] == "REPLAN_ROUTE_WARNING"

    state["warnings"] = []
    original_route = route

    def change_base(*args, **kwargs):
        from app.persistence.models import PlanVersion

        draft = db.get(PlanVersion, UUID(ctx["base_version_id"]))
        draft.edit_sequence += 1
        db.flush()
        return original_route(*args, **kwargs)

    monkeypatch.setattr(journeys, "geoapify_checks", SimpleNamespace(route=change_base))
    changed = client.post(
        base + "/preview", json=payload, headers={"If-Match": ctx["base_etag"]}
    )
    assert (
        changed.status_code == 409 and changed.json()["code"] == "REPLAN_BASE_CHANGED"
    )


def test_clock_change_day_is_explicitly_unsupported_before_provider_calls():
    from datetime import date

    plan, body, _ = fixture()
    plan.stops[0].timezone = "America/New_York"
    body = body.model_copy(
        update={
            "local_date": date(2026, 11, 1),
            "local_time": "10:15",
            "utc_offset_minutes": -300,
        }
    )
    now = datetime(2026, 11, 1, 15, 15, tzinfo=timezone.utc)
    calls = []
    with pytest.raises(PreviewConflict) as error:
        remaining_day_preview(plan, body, now, lambda *args: calls.append(args) or 0)
    assert error.value.code == "REPLAN_DST_DAY" and calls == []
