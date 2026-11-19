from uuid import uuid4

import pytest
import test_proposals

from app.planning.stay_rebalance import (
    RebalanceConflict,
    RebalanceInput,
    rebalance_stays,
)
from app.trips.schemas import PlanInput


def plan(**changes):
    one, two = str(uuid4()), str(uuid4())
    acts = [
        dict(
            logical_id=str(uuid4()),
            stop_logical_id=two,
            user_label=label,
            local_day_offset=day,
            local_start_time="10:00",
            duration_minutes=60,
            **flags,
        )
        for label, day, flags in [
            ("Lake walk", 3, {}),
            ("Palace", 4, {}),
            ("Cooking class", 2, {"booked": True}),
        ]
    ]
    data = dict(
        date_mode="duration",
        desired_days=10,
        traveler_count=2,
        stops=[
            dict(
                client_id=one, name="Jaipur", timezone="Asia/Kolkata", desired_nights=4
            ),
            dict(
                client_id=two, name="Udaipur", timezone="Asia/Kolkata", desired_nights=4
            ),
        ],
        activities=acts,
        preferences=dict(
            stay_preferences={
                one: dict(style="hotel", rate="100", basis="room"),
                two: dict(style="hotel", rate="200", basis="room"),
            }
        ),
        costs=[
            dict(
                id=str(uuid4()),
                category="activity",
                label=label,
                unit="per_group",
                quantity=1,
                amount="30",
                status=status,
                activity_id=acts[1]["logical_id"],
            )
            for label, status in (
                ("Palace ticket", "paid"),
                ("Palace guide", "estimated"),
            )
        ],
    )
    data.update(changes)
    return PlanInput.model_validate(data), one, two, acts


def test_moving_a_night_between_stays_keeps_trip_length_and_updates_allowances():
    p, one, two, _ = plan()
    candidate, summary = rebalance_stays(
        p, RebalanceInput(stop_id=two, delta_nights=1, counterpart=one)
    )
    assert [s.desired_nights for s in candidate.stops] == [3, 5]
    assert candidate.desired_days == 10
    # Allowances 1200 → 1300, plus the 30 guide estimate.
    assert (summary["estimated_before"], summary["estimated_after"]) == (
        "1230.00",
        "1330.00",
    )
    assert summary["dropped"] == [] and len(candidate.activities) == 3


def test_shrinking_a_stay_never_drops_activities_silently():
    p, one, two, acts = plan()
    body = dict(stop_id=one, delta_nights=1, counterpart=two)
    p2 = PlanInput.model_validate({**p.model_dump(mode="json"), "activities": acts[:2]})
    # Udaipur 4 → 3 nights: day offset 4 (Palace) no longer exists.
    with pytest.raises(RebalanceConflict) as blocked:
        rebalance_stays(p2, RebalanceInput(**body))
    assert blocked.value.code == "REBALANCE_DISPLACED"
    assert "remaining day in your route" in str(blocked.value)
    assert [a["label"] for a in blocked.value.activities] == ["Palace"]
    candidate, summary = rebalance_stays(
        p2, RebalanceInput(**body, drop_activity_ids=[acts[1]["logical_id"]])
    )
    assert [a.user_label for a in candidate.activities] == ["Lake walk"]
    # The paid ticket stays as a commitment; the estimate goes.
    assert [(c.label, c.link_removed) for c in candidate.costs] == [
        ("Palace ticket", True)
    ]
    assert summary["kept_payments"] == ["Palace ticket"]
    with pytest.raises(RebalanceConflict) as wrong:
        rebalance_stays(
            p2, RebalanceInput(**body, drop_activity_ids=[acts[0]["logical_id"]])
        )
    assert wrong.value.code == "REBALANCE_DROP_INVALID"


def test_protected_activities_block_and_lengths_are_checked():
    p, one, two, acts = plan()
    with pytest.raises(RebalanceConflict) as blocked:
        rebalance_stays(
            p,
            RebalanceInput(
                stop_id=two,
                delta_nights=-3,
                counterpart="trip_length",
                drop_activity_ids=[a["logical_id"] for a in acts[:2]],
            ),
        )
    assert blocked.value.code == "REBALANCE_PROTECTED"
    assert blocked.value.activities[0]["label"] == "Cooking class"
    with pytest.raises(RebalanceConflict) as short:
        rebalance_stays(p, RebalanceInput(stop_id=two, delta_nights=5, counterpart=one))
    assert short.value.code == "REBALANCE_NEGATIVE"
    with pytest.raises(ValueError):
        RebalanceInput(stop_id=one, delta_nights=0, counterpart=two)
    with pytest.raises(ValueError):
        RebalanceInput(stop_id=one, delta_nights=1, counterpart=one)


def test_extending_the_trip_updates_duration_or_end_date():
    p, one, _, _ = plan()
    candidate, summary = rebalance_stays(
        p, RebalanceInput(stop_id=one, delta_nights=2, counterpart="trip_length")
    )
    assert candidate.desired_days == 12 and summary["trip_days_after"] == 12
    exact, one, _, _ = plan(
        date_mode="exact",
        start_date="2026-12-01",
        end_date="2026-12-10",
        desired_days=None,
        activities=[],
    )
    candidate, summary = rebalance_stays(
        exact, RebalanceInput(stop_id=one, delta_nights=1, counterpart="trip_length")
    )
    assert summary["end_date_after"] == "2026-12-11"
    assert summary["trip_days_after"] == 11


@pytest.fixture
def context():
    yield from test_proposals.context.__wrapped__()


def test_endpoint_previews_then_applies_to_the_draft_only(context):
    client, _, _ = context
    p, one, two, acts = plan()
    trip = client.post(
        "/api/v1/trips", json={"title": "Rebalance", "plan": p.model_dump(mode="json")}
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    path = base + f"/versions/{trip['draft_version_id']}"
    tag = client.get(path).headers["etag"]
    body = dict(stop_id=one, delta_nights=1, counterpart=two)
    blocked = client.post(
        base + "/draft/stay-rebalance", json=body, headers={"If-Match": tag}
    )
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "REBALANCE_DISPLACED"
    assert [a["label"] for a in blocked.json()["activities"]] == ["Palace"]
    body = dict(stop_id=two, delta_nights=1, counterpart=one)
    preview = client.post(
        base + "/draft/stay-rebalance", json=body, headers={"If-Match": tag}
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["data"]["applied"] is False
    assert client.get(path).headers["etag"] == tag, "a preview changes nothing"
    applied = client.post(
        base + "/draft/stay-rebalance",
        json={**body, "apply": True},
        headers={"If-Match": tag},
    )
    assert applied.status_code == 200, applied.text
    stops = client.get(path + "/stops").json()["data"]
    assert [s["desired_nights"] for s in stops] == [3, 5]
    assert client.get(base).json()["data"]["current_version_id"] is None
    stale = client.post(
        base + "/draft/stay-rebalance", json=body, headers={"If-Match": tag}
    )
    assert stale.status_code == 412


def test_displaced_activities_can_move_to_a_remaining_day_of_the_same_stay():
    p, one, two, acts = plan()
    palace = acts[1]["logical_id"]  # Udaipur day 5 (offset 4)
    body = dict(stop_id=one, delta_nights=1, counterpart=two)
    candidate, summary = rebalance_stays(
        p, RebalanceInput(**body, relocate=[dict(activity_id=palace, day_offset=1)])
    )
    moved = next(a for a in candidate.activities if str(a.logical_id) == palace)
    assert moved.local_day_offset == 1 and str(moved.stop_logical_id) == two
    assert (
        summary["moved"][0]["label"] == "Palace" and summary["moved"][0]["to_day"] == 2
    )
    # Linked costs stay linked: the activity still exists.
    assert {c.label for c in candidate.costs} == {"Palace ticket", "Palace guide"}
    assert all(not c.link_removed for c in candidate.costs)
    with pytest.raises(RebalanceConflict) as gone:
        rebalance_stays(
            p, RebalanceInput(**body, relocate=[dict(activity_id=palace, day_offset=4)])
        )
    assert gone.value.code == "REBALANCE_MOVE_INVALID"
    # Day 3 (offset 2) already holds the 10:00 cooking class.
    with pytest.raises(RebalanceConflict) as clash:
        rebalance_stays(
            p, RebalanceInput(**body, relocate=[dict(activity_id=palace, day_offset=2)])
        )
    assert clash.value.code == "REBALANCE_OVERLAP"
    assert "Cooking class" in clash.value.activities[0]["detail"]
    with pytest.raises(ValueError):
        RebalanceInput(
            **body,
            drop_activity_ids=[palace],
            relocate=[dict(activity_id=palace, day_offset=1)],
        )
    cooking = acts[2]["logical_id"]
    with pytest.raises(RebalanceConflict) as protected:
        rebalance_stays(
            p,
            RebalanceInput(
                stop_id=two,
                delta_nights=-3,
                counterpart="trip_length",
                relocate=[
                    dict(activity_id=a["logical_id"], day_offset=0) for a in acts
                ],
            ),
        )
    assert protected.value.code == "REBALANCE_PROTECTED"
    assert cooking == protected.value.activities[0]["activity_id"]


def test_a_moved_activity_can_take_a_new_time_on_its_new_day():
    p, one, two, acts = plan()
    palace = acts[1]["logical_id"]
    body = dict(stop_id=one, delta_nights=1, counterpart=two)
    # Day 3 has the 10:00–11:00 cooking class; 14:00 avoids it.
    candidate, summary = rebalance_stays(
        p,
        RebalanceInput(
            **body,
            relocate=[dict(activity_id=palace, day_offset=2, local_start_time="14:00")],
        ),
    )
    moved = next(a for a in candidate.activities if str(a.logical_id) == palace)
    assert (moved.local_day_offset, moved.local_start_time.strftime("%H:%M")) == (
        2,
        "14:00",
    )
    assert summary["moved"][0]["to_start"] == "14:00"
    with pytest.raises(RebalanceConflict) as late:
        rebalance_stays(
            p,
            RebalanceInput(
                **body,
                relocate=[
                    dict(activity_id=palace, day_offset=1, local_start_time="23:30")
                ],
            ),
        )
    assert late.value.code == "REBALANCE_OVERLAP"
    assert "midnight" in late.value.activities[0]["detail"].lower()
    with pytest.raises(ValueError):
        RebalanceInput(
            **body,
            relocate=[dict(activity_id=palace, day_offset=1, local_start_time="25:00")],
        )


def test_moving_to_another_stay_clears_the_map_link_but_keeps_costs():
    p, one, two, acts = plan()
    data = p.model_dump(mode="json")
    data["activities"][1]["google_place_id"] = "ChIJ_palace"
    p = PlanInput.model_validate(data)
    palace = acts[1]["logical_id"]
    body = dict(stop_id=one, delta_nights=1, counterpart=two)
    candidate, summary = rebalance_stays(
        p,
        RebalanceInput(
            **body,
            relocate=[dict(activity_id=palace, day_offset=5, stop_id=one)],
        ),
    )
    moved = next(a for a in candidate.activities if str(a.logical_id) == palace)
    assert str(moved.stop_logical_id) == one and moved.local_day_offset == 5
    assert moved.google_place_id is None and moved.place_id is None
    entry = summary["moved"][0]
    assert entry["to_destination"] == "Jaipur" and entry["map_cleared"] is True
    assert all(not c.link_removed for c in candidate.costs)
    # Jaipur grows to 5 nights, so offset 6 does not exist there.
    with pytest.raises(RebalanceConflict) as beyond:
        rebalance_stays(
            p,
            RebalanceInput(
                **body, relocate=[dict(activity_id=palace, day_offset=6, stop_id=one)]
            ),
        )
    assert beyond.value.code == "REBALANCE_MOVE_INVALID"
    with pytest.raises(RebalanceConflict) as nowhere:
        rebalance_stays(
            p,
            RebalanceInput(
                **body,
                relocate=[dict(activity_id=palace, day_offset=0, stop_id=str(uuid4()))],
            ),
        )
    assert nowhere.value.code == "REBALANCE_MOVE_INVALID"


@pytest.mark.parametrize("flag", ["fixed", "booked", "completed", "skipped"])
def test_rebalancing_cannot_shift_a_protected_activitys_calendar_date(flag):
    p, one, two, acts = plan(
        date_mode="exact",
        start_date="2026-12-01",
        end_date="2026-12-10",
        desired_days=None,
    )
    data = p.model_dump(mode="json")
    for activity in data["activities"]:
        activity["booked"] = False
    data["activities"][2][flag] = True
    p = PlanInput.model_validate(data)
    original = p.model_dump(mode="json")
    with pytest.raises(RebalanceConflict) as blocked:
        rebalance_stays(p, RebalanceInput(stop_id=two, delta_nights=1, counterpart=one))
    assert blocked.value.code == "REBALANCE_PROTECTED_DATE"
    assert blocked.value.activities[0]["activity_id"] == acts[2]["logical_id"]
    assert "2026-12-07 to 2026-12-06" in blocked.value.activities[0]["detail"]
    assert p.model_dump(mode="json") == original
    # Growing only the final stay leaves the commitment's actual date alone.
    candidate, _ = rebalance_stays(
        p, RebalanceInput(stop_id=two, delta_nights=1, counterpart="trip_length")
    )
    assert (
        next(
            a
            for a in candidate.activities
            if a.logical_id == p.activities[2].logical_id
        ).resolved
        == p.activities[2].resolved
    )


def test_protected_calendar_date_guard_accounts_for_travel_nights():
    import json

    p, one, two, _ = plan(
        date_mode="exact",
        start_date="2026-12-01",
        end_date="2026-12-12",
        desired_days=None,
    )
    data = p.model_dump(mode="json")
    data["preferences"]["travel_preferences"] = {
        json.dumps(["origin:", one], separators=(",", ":")): dict(
            mode="Rail", hours="8", overnight=1, rate="", basis="person"
        ),
        json.dumps([one, two], separators=(",", ":")): dict(
            mode="Rail", hours="8", overnight=1, rate="", basis="person"
        ),
    }
    p = PlanInput.model_validate(data)
    with pytest.raises(RebalanceConflict) as blocked:
        rebalance_stays(p, RebalanceInput(stop_id=two, delta_nights=1, counterpart=one))
    assert "2026-12-09 to 2026-12-08" in blocked.value.activities[0]["detail"]


def test_endpoint_refuses_dated_commitment_shift_without_writing(context):
    client, _, _ = context
    p, one, two, _ = plan(
        date_mode="exact",
        start_date="2026-12-01",
        end_date="2026-12-10",
        desired_days=None,
    )
    trip = client.post(
        "/api/v1/trips",
        json={"title": "Dated commitment", "plan": p.model_dump(mode="json")},
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    path = base + f"/versions/{trip['draft_version_id']}"
    before = client.get(path)
    stops_before = client.get(path + "/stops").json()["data"]
    for apply in (False, True):
        result = client.post(
            base + "/draft/stay-rebalance",
            headers={"If-Match": before.headers["etag"]},
            json=dict(stop_id=two, delta_nights=1, counterpart=one, apply=apply),
        )
        assert result.status_code == 409
        assert result.json()["code"] == "REBALANCE_PROTECTED_DATE"
    assert client.get(path).headers["etag"] == before.headers["etag"]
    assert client.get(path + "/stops").json()["data"] == stops_before
