from datetime import date, datetime, timezone
from uuid import UUID, uuid4

import pytest
import test_trips

from app.api import replanning
from app.planning.readiness import ReadinessInput, readiness_report, reported_instant
from app.trips.schemas import PlanInput


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def inputs():
    stop = uuid4()
    plan = PlanInput.model_validate(
        {
            "stops": [
                {
                    "client_id": str(stop),
                    "name": "Jaipur",
                    "timezone": "Asia/Kolkata",
                    "desired_nights": 20,
                }
            ],
            "activities": [
                dict(
                    logical_id=str(uuid4()),
                    stop_logical_id=str(stop),
                    user_label=label,
                    local_day_offset=12,
                    local_start_time=start,
                    duration_minutes=30,
                    **flags,
                )
                for label, start, flags in [
                    ("Done", "08:00", {"completed": True}),
                    ("Past", "09:00", {}),
                    ("Ongoing", "10:00", {}),
                    ("Booking", "11:00", {"booked": True}),
                    ("Flexible", "12:00", {}),
                ]
            ],
        }
    )
    body = ReadinessInput(
        basis="draft",
        base_version_id=uuid4(),
        scope="remaining_day",
        stop_id=stop,
        local_day_offset=12,
        local_date=date(2026, 11, 14),
        local_time="10:15",
        utc_offset_minutes=330,
        current_location_place_id=uuid4(),
        confirmed=True,
    )
    return plan, body, datetime(2026, 11, 14, 4, 45, tzinfo=timezone.utc)


def test_readiness_is_read_only_and_does_not_infer_completion():
    plan, body, now = inputs()
    before = plan.model_dump()
    result = readiness_report(plan, body, now)
    assert plan.model_dump() == before
    assert [
        [a.label for a in result[k]]
        for k in (
            "completed",
            "past_unresolved",
            "in_progress",
            "protected",
            "flexible",
        )
    ] == [["Done"], ["Past"], ["Ongoing"], ["Booking"], ["Flexible"]]
    assert result["status"] == "needs_attention"
    assert {"PAST_UNRESOLVED", "IN_PROGRESS_UNCONFIRMED"} <= {
        i["code"] for i in result["issues"]
    }


@pytest.mark.parametrize(
    "change,code",
    [
        ({"local_time": "10:00"}, "REPLAN_TIME_STALE"),
        ({"utc_offset_minutes": 0}, "REPLAN_TIME_OFFSET_MISMATCH"),
        ({"local_date": date(2026, 11, 13)}, "REPLAN_DATE_NOT_TODAY"),
        ({"local_day_offset": 21}, "REPLAN_SCOPE_UNAVAILABLE"),
    ],
)
def test_context_rejections(change, code):
    plan, body, now = inputs()
    with pytest.raises(ValueError, match=code):
        readiness_report(plan, body.model_copy(update=change), now)


def test_dst_gap_and_both_repeated_hour_offsets():
    with pytest.raises(ValueError, match="OFFSET_MISMATCH"):
        reported_instant("America/New_York", date(2026, 3, 8), "02:30", -300)
    first, _ = reported_instant("America/New_York", date(2026, 11, 1), "01:30", -240)
    second, _ = reported_instant("America/New_York", date(2026, 11, 1), "01:30", -300)
    assert (second - first).total_seconds() == 3600


def test_owned_context_and_stale_precondition(context, monkeypatch):
    client, db, identity = context
    plan, body, now = inputs()
    monkeypatch.setattr(replanning, "current_time", lambda: now)
    trip = client.post(
        "/api/v1/trips",
        json={"title": "Readiness QA", "plan": plan.model_dump(mode="json")},
    ).json()["data"]
    path = f"/api/v1/trips/{trip['id']}/replanning"
    params = {"basis": "draft", "stop_id": str(body.stop_id), "local_day_offset": 12}
    response = client.get(path + "/context", params=params)
    assert response.status_code == 200, response.text
    ctx = response.json()["data"]
    assert ctx["current_local_time"] == "10:15" and ctx["utc_offset_minutes"] == 330
    assert len(ctx["activities"]) == 5 and ctx["known_locations"] == []
    assert response.headers["cache-control"] == "private, no-store"
    payload = body.model_copy(
        update={"base_version_id": UUID(trip["draft_version_id"])}
    ).model_dump(mode="json")
    assert client.post(path + "/readiness", json=payload).status_code == 428
    assert (
        client.post(
            path + "/readiness", json=payload, headers={"If-Match": '"old"'}
        ).json()["code"]
        == "REPLAN_BASE_CHANGED"
    )
    # An arbitrary map ID cannot be treated as the traveler's current location.
    assert (
        client.post(
            path + "/readiness", json=payload, headers={"If-Match": ctx["base_etag"]}
        ).json()["code"]
        == "REPLAN_LOCATION_MISMATCH"
    )
    assert (
        client.get(path + "/context", params={**params, "basis": "accepted"}).json()[
            "code"
        ]
        == "REPLAN_BASE_UNAVAILABLE"
    )
    from app.api.identity import TrustedIdentity, verified_identity
    from app.main import app

    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "test-issuer", str(uuid4()), "other@example.org", "Other"
    )
    assert client.get(path + "/context", params=params).status_code == 404


def test_ready_when_only_completed_and_future_protected_or_flexible():
    plan, body, now = inputs()
    for a in plan.activities:
        if a.user_label in ("Past", "Ongoing"):
            a.completed = True
    result = readiness_report(plan, body, now)
    assert result["status"] == "ready_for_proposal" and result["issues"] == []
    assert [a.label for a in result["protected"]] == ["Booking"]
    assert [a.label for a in result["flexible"]] == ["Flexible"]


def test_exact_date_mismatch_and_empty_future():
    plan, body, now = inputs()
    plan.date_mode = "exact"
    plan.start_date = date(2026, 11, 1)
    with pytest.raises(ValueError, match="REPLAN_SCHEDULE_DATE_MISMATCH"):
        readiness_report(plan, body, now)
    plan.date_mode = "flexible"
    plan.activities = []
    report = readiness_report(plan, body, now)
    assert report["status"] == "needs_attention"
    assert report["issues"][0]["code"] == "NO_FLEXIBLE_REMAINDER"


def test_real_readiness_report_preserves_rows_and_separates_accepted_from_draft(
    context, monkeypatch
):
    import test_place_references
    import test_proposals
    from sqlalchemy import func, select

    from app.persistence.models import Activity, DiscoveredPlace, PlanVersion, Trip

    client, db, _ = context
    reference = test_place_references.selected(client, monkeypatch)
    plan, body, _ = inputs()
    stop = plan.stops[0]
    stop.name = reference["label"]
    stop.timezone = reference["timezone"]
    stop.place_reference_id = UUID(reference["reference_id"])
    from zoneinfo import ZoneInfo

    now = datetime(2026, 11, 14, 10, 15, tzinfo=ZoneInfo(stop.timezone)).astimezone(
        timezone.utc
    )
    monkeypatch.setattr(replanning, "current_time", lambda: now)
    for a in plan.activities:
        if a.user_label in ("Past", "Ongoing"):
            a.completed = True
    trip = client.post(
        "/api/v1/trips",
        json={"title": "Readiness basis QA", "plan": plan.model_dump(mode="json")},
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    params = dict(basis="draft", stop_id=str(body.stop_id), local_day_offset=12)
    ctx = client.get(base + "/replanning/context", params=params).json()["data"]
    place = DiscoveredPlace(
        id=uuid4(),
        destination_reference_id=stop.place_reference_id,
        payload=dict(
            external_id="node/123",
            name="QA location",
            category="park",
            latitude=35.02,
            longitude=135.75,
            source="OpenStreetMap contributors via Overpass",
            retrieved_at=now.isoformat(),
        ),
    )
    db.add(place)
    db.commit()
    payload = {
        **body.model_dump(mode="json"),
        "base_version_id": ctx["base_version_id"],
        "utc_offset_minutes": ctx["utc_offset_minutes"],
        "current_location_place_id": str(place.id),
    }
    before = db.scalar(select(func.count()).select_from(PlanVersion))
    db.commit()
    response = client.post(
        base + "/replanning/readiness",
        json=payload,
        headers={"If-Match": ctx["base_etag"]},
    )
    assert response.status_code == 200, response.text
    report = response.json()["data"]
    assert (
        report["status"] == "ready_for_proposal"
        and report["current_location"]["name"] == "QA location"
    )
    assert len(report["completed"]) == 3 and len(report["protected"]) == 1
    assert db.scalar(select(func.count()).select_from(PlanVersion)) == before
    assert db.get(Trip, UUID(trip["id"])).lifecycle == "planning"
    db.commit()
    proposal = test_proposals.submit(client, base, ctx["base_etag"]).json()["data"]
    assert test_proposals.accept(client, base, proposal).status_code == 200
    accepted = client.get(
        base + "/replanning/context", params={**params, "basis": "accepted"}
    ).json()["data"]
    current = client.get(base + "/replanning/context", params=params).json()["data"]
    draft = db.get(PlanVersion, UUID(current["base_version_id"]))
    item = db.scalars(select(Activity).where(Activity.version_id == draft.id)).first()
    item.user_label = "Draft only title"
    draft.edit_sequence += 1
    db.commit()
    assert (
        client.post(
            base + "/replanning/readiness",
            json={**payload, "base_version_id": current["base_version_id"]},
            headers={"If-Match": current["base_etag"]},
        ).json()["code"]
        == "REPLAN_BASE_CHANGED"
    )
    assert all(a["label"] != "Draft only title" for a in accepted["activities"])
    assert any(
        a["label"] == "Draft only title"
        for a in client.get(base + "/replanning/context", params=params).json()["data"][
            "activities"
        ]
    )
    result = client.post(
        base + "/replanning/readiness",
        json={
            **payload,
            "basis": "accepted",
            "base_version_id": accepted["base_version_id"],
        },
        headers={"If-Match": accepted["base_etag"]},
    )
    assert result.status_code == 200, result.text


def test_a_searched_stay_is_offered_as_a_known_location_only_when_its_record_exists(
    context, monkeypatch
):
    import test_place_references

    from app.persistence.models import DiscoveredPlace
    from app.trips.schemas import Lodging, StayPreference

    client, db, _ = context
    reference = test_place_references.selected(client, monkeypatch)
    plan, body, now = inputs()
    stop = plan.stops[0]
    stop.name = reference["label"]
    stop.timezone = reference["timezone"]
    stop.place_reference_id = UUID(reference["reference_id"])

    def place(destination):
        row = DiscoveredPlace(
            id=uuid4(),
            destination_reference_id=destination,
            payload=dict(
                external_id="node/777",
                name="Hotel Aurora",
                category="lodging",
                latitude=35.02,
                longitude=135.75,
                source="OpenStreetMap contributors via Overpass",
                retrieved_at=now.isoformat(),
            ),
        )
        db.add(row)
        db.commit()
        return row

    def locations(row, external_id="node/777", as_extra=False):
        hotel = Lodging(
            name="Hotel Aurora",
            latitude=35.02,
            longitude=135.75,
            external_id=external_id,
            place_id=row.id,
            **(dict(first_night=2, last_night=3) if as_extra else {}),
        )
        plan.preferences.stay_preferences[stop.client_id] = StayPreference(
            style="",
            rate="",
            basis="room",
            lodging=Lodging(name="Main stay") if as_extra else hotel,
            extra_lodgings=[hotel] if as_extra else [],
        )
        db.commit()
        trip = client.post(
            "/api/v1/trips",
            json={"title": "Stay location", "plan": plan.model_dump(mode="json")},
        ).json()["data"]
        params = dict(basis="draft", stop_id=str(body.stop_id), local_day_offset=12)
        db.commit()
        ctx = client.get(
            f"/api/v1/trips/{trip['id']}/replanning/context", params=params
        ).json()["data"]
        return [p["name"] for p in ctx["known_locations"]]

    assert locations(place(stop.place_reference_id)) == ["Hotel Aurora"]
    # Another stay in the destination is offered the same way.
    assert locations(place(stop.place_reference_id), as_extra=True) == ["Hotel Aurora"]
    # A stay whose id points at a different place than it names is never offered.
    assert locations(place(stop.place_reference_id), "node/999") == []
    # A record the server does not hold is never offered.
    from types import SimpleNamespace

    assert locations(SimpleNamespace(id=uuid4())) == []
