import json
from decimal import Decimal
from uuid import uuid4

import pytest
import test_proposals
import test_revisions

from app.planning.cost_coverage import project_costs
from app.trips.schemas import PlanInput


def fixture():
    one, two = str(uuid4()), str(uuid4())
    keys = [
        json.dumps(pair, separators=(",", ":"), ensure_ascii=False)
        for pair in [("origin:Delhi", one), (one, two), (two, "finish:Delhi")]
    ]
    plan = PlanInput.model_validate(
        dict(
            origin={"label": "Delhi"},
            traveler_count=3,
            room_count=2,
            stops=[
                dict(
                    client_id=one,
                    name="Same city",
                    timezone="Asia/Kolkata",
                    desired_nights=13,
                ),
                dict(
                    client_id=two,
                    name="Same city",
                    timezone="Asia/Kolkata",
                    desired_nights=4,
                ),
            ],
            preferences=dict(
                stay_preferences={
                    one: dict(style="hotel", rate="0.10", basis="room"),
                    two: dict(style="hostel", rate="1.25", basis="bed"),
                },
                travel_preferences={
                    keys[0]: dict(
                        mode="rail", hours="", overnight=1, rate="0.01", basis="person"
                    ),
                    keys[1]: dict(
                        mode="bus", hours="", overnight=0, rate="2.05", basis="vehicle"
                    ),
                },
            ),
        )
    )
    return plan


def test_units_repeated_cities_and_leg_prices_are_counted_once():
    plan = fixture()
    before = plan.model_dump(mode="json")
    coverage = project_costs(plan, uuid4())
    assert [r.quantity for r in coverage.rows] == [26, 12, 3, 1, 3]
    assert coverage.estimated_subtotal == Decimal("19.68")
    assert coverage.known_allowances == 4 and coverage.unknown_allowances == 1
    assert coverage.rows[0].estimated_amount == Decimal("2.60")
    assert plan.model_dump(mode="json") == before


def test_missing_allocation_and_rates_stay_unknown_but_zero_is_explicit():
    plan = fixture()
    plan.stops[0].desired_nights = None
    plan.stops[1].desired_nights = 0
    coverage = project_costs(plan, uuid4())
    assert (
        coverage.rows[0].quantity is None and coverage.rows[0].estimated_amount is None
    )
    assert sum(r.category == "accommodation" for r in coverage.rows) == 1
    p = next(iter(plan.preferences.travel_preferences.values()))
    p.rate = "0"
    coverage = project_costs(plan, uuid4())
    row = coverage.rows[1]
    assert row.amount_status == "estimated" and row.estimated_amount == 0


def test_unknown_total_paid_and_categories_never_become_zero_or_strict_verified():
    plan = fixture()
    plan = PlanInput.model_validate(
        {**plan.model_dump(), "budget": {"amount": "100", "mode": "strict"}}
    )
    coverage = project_costs(plan, uuid4())
    assert (
        coverage.coverage_complete is False
        and coverage.total is None
        and coverage.paid_total is None
    )
    assert (
        "Meals" in coverage.unpriced_categories
        and "Local transport" in coverage.unpriced_categories
    )
    assert coverage.budget_mode == "strict" and not coverage.estimates_exceed_budget


def test_large_prices_are_exact_and_orphan_allowances_are_ignored():
    plan = fixture()
    first = plan.stops[0].client_id
    plan.preferences.stay_preferences[first].rate = "1000000000000000.01"
    plan.preferences.stay_preferences["removed"] = plan.preferences.stay_preferences[
        first
    ]
    coverage = project_costs(plan, uuid4())
    assert coverage.rows[0].estimated_amount == Decimal("26000000000000000.26")
    assert len(coverage.rows) == 5


def test_one_way_route_and_empty_trip_do_not_invent_return_costs():
    plan = fixture()
    plan.preferences.return_to_origin = False
    assert len(project_costs(plan, uuid4()).rows) == 4
    empty = project_costs(PlanInput(), uuid4())
    assert empty.rows == [] and empty.known_allowances == 0 and empty.total is None


@pytest.fixture
def context():
    yield from test_proposals.context.__wrapped__()


def test_budget_endpoint_is_owned_conditional_and_does_not_modify_snapshot(context):
    client, _, _ = context
    base, trip, tag = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    before = client.get(path).json()
    metadata = client.get(base).json()
    response = client.get(path + "/budget", headers={"If-Match": tag})
    assert response.status_code == 200, response.text
    body = response.json()["data"]
    assert (
        body["version_id"] == trip["draft_version_id"]
        and body["total"] is None
        and body["paid_total"] is None
    )
    assert response.headers["etag"] == tag
    assert client.get(path).json()["data"] == before["data"]
    assert client.get(base).json()["data"] == metadata["data"]
    assert (
        client.get(path + "/budget", headers={"If-Match": '"old"'}).status_code == 412
    )
    other = client.post("/api/v1/trips", json={"title": "Other"}).json()["data"]
    assert (
        client.get(base + f"/versions/{other['draft_version_id']}/budget").status_code
        == 404
    )
    from app.api.identity import TrustedIdentity, verified_identity
    from app.main import app

    app.dependency_overrides[verified_identity] = lambda: TrustedIdentity(
        "test-issuer", "different-owner", "other@example.org", "other@example.org"
    )
    assert client.get(path + "/budget").status_code == 404


def test_frozen_review_costs_do_not_change_with_later_draft_allowances(context):
    client, _, _ = context
    base, trip, tag = test_proposals.setup(client)
    proposal = test_proposals.submit(client, base, tag).json()["data"]
    frozen = base + f"/versions/{proposal['candidate_version_id']}/budget"
    before = client.get(frozen).json()["data"]
    path = base + f"/versions/{trip['draft_version_id']}"
    version = client.get(path)
    changes = {
        k: v for k, v in version.json()["data"].items() if k in PlanInput.model_fields
    }
    stop = client.get(path + "/stops").json()["data"][0]["logical_item_id"]
    changes["stops"] = []
    changes["activities"] = []
    changes["budget"] = {"amount": "1", "mode": "target"}
    changes["preferences"]["stay_preferences"] = {
        stop: {"style": "hotel", "rate": "12.34", "basis": "room"}
    }
    saved = client.post(
        base + "/draft/commands",
        headers={"If-Match": version.headers["etag"]},
        json={"commands": [{"type": "plan.update_settings", "changes": changes}]},
    )
    assert saved.status_code == 200, saved.text
    after = client.get(path + "/budget").json()["data"]
    assert after["estimated_subtotal"] == "24.68" and after["estimates_exceed_budget"]
    assert client.get(frozen).json()["data"] == before


def with_records(plan, records, budget=None):
    data = plan.model_dump(mode="json")
    data["costs"] = records
    if budget:
        data["budget"] = budget
    return PlanInput.model_validate(data)


def record(**changes):
    return {
        "id": str(uuid4()),
        "category": "food",
        "label": "Dinners",
        "unit": "per_person",
        "quantity": 4,
        "amount": "12.50",
        "status": "estimated",
        **changes,
    }


def test_records_multiply_units_and_keep_paid_separate_from_estimates():
    plan = with_records(
        fixture(),
        [
            record(),
            record(
                category="miscellaneous",
                label="Museum passes",
                unit="per_group",
                quantity=1,
                amount="40",
                status="paid",
            ),
            record(label="Snacks", amount=""),
            record(label="Free breakfast", amount="0", quantity=2),
        ],
        {"amount": "200", "mode": "target"},
    )
    coverage = project_costs(plan, uuid4())
    rows = coverage.records
    assert plan.costs[1].amount == "40.00", "amounts have one canonical spelling"
    assert rows[0].travelers == 3 and rows[0].amount == Decimal("150.00")
    assert rows[1].travelers is None and rows[1].amount_status == "paid"
    assert rows[2].amount is None and rows[2].amount_status == "unknown"
    assert rows[3].amount == 0 and rows[3].amount_status == "estimated"
    assert coverage.estimated_subtotal == Decimal("169.68")
    assert coverage.recorded_paid_subtotal == Decimal("40.00")
    assert coverage.known_subtotal == Decimal("209.68")
    assert (coverage.estimated_records, coverage.paid_records) == (2, 1)
    assert coverage.unknown_records == 1 and coverage.estimates_exceed_budget
    # An entry is not complete coverage; totals stay unknown.
    assert "Meals" not in coverage.unpriced_categories
    assert "Miscellaneous" not in coverage.unpriced_categories
    assert "Activities" in coverage.unpriced_categories
    assert coverage.total is None and coverage.paid_total is None
    assert coverage.coverage_complete is False


def test_invalid_records_are_rejected():
    plan = fixture()
    duplicate = record()
    for bad in [
        [record(status="paid", amount="")],
        [record(amount="-1")],
        [record(amount="1.234")],
        [record(quantity=0)],
        [record(label="   ")],
        [record(category="adjustment")],
        [record(unit="per_room_night")],
        [record(extra=True)],
        [record(activity_id=str(uuid4()), stop_id=str(uuid4()))],
        [record(link_removed=True)],
        [record(status="paid", link_removed=True, stop_id=str(uuid4()))],
        [duplicate, duplicate],
    ]:
        with pytest.raises(ValueError):
            with_records(plan, bad)


def linked_plan():
    plan = fixture()
    stop = plan.stops[0].client_id
    activity = str(uuid4())
    data = plan.model_dump(mode="json")
    data["activities"] = [
        dict(
            logical_id=activity,
            stop_logical_id=stop,
            user_label="Amber Fort",
            local_day_offset=0,
            local_start_time="09:00",
            duration_minutes=120,
        )
    ]
    data["costs"] = [
        record(
            category="activity",
            label="Fort tickets",
            activity_id=activity,
            status="paid",
            amount="40",
            unit="per_group",
            quantity=1,
        ),
        record(category="activity", label="Audio guide", activity_id=activity),
        record(
            category="accommodation",
            label="City tax",
            stop_id=stop,
            unit="per_group",
            quantity=1,
            amount="3",
        ),
    ]
    return PlanInput.model_validate(data), activity, stop


def test_linked_costs_name_their_item_and_follow_the_removal_rule():
    plan, activity, stop = linked_plan()
    rows = project_costs(plan, uuid4()).records
    assert [r.linked_to for r in rows] == ["Amber Fort", "Amber Fort", "Same city"]
    assert "Activities" not in project_costs(plan, uuid4()).unpriced_categories
    data = plan.model_dump(mode="json")
    data["activities"] = []
    data["stops"] = data["stops"][1:]
    removed = PlanInput.model_validate(data)
    # The estimate for the removed visit goes with it; the stay estimate too.
    # The paid ticket stays as an unlinked commitment: no implied refund.
    assert [(c.label, c.link_removed, c.activity_id) for c in removed.costs] == [
        ("Fort tickets", True, None)
    ]
    coverage = project_costs(removed, uuid4())
    assert coverage.records[0].link_removed and coverage.records[0].linked_to is None
    assert coverage.recorded_paid_subtotal == Decimal("40.00")
    again = PlanInput.model_validate(removed.model_dump(mode="json"))
    assert again.costs == removed.costs, "the rule is idempotent"


def test_strict_budget_stays_blocked_with_complete_looking_records():
    from app.planning.validation import validate_plan

    plan = with_records(fixture(), [record()], {"amount": "999999", "mode": "strict"})
    report = validate_plan(plan)
    assert any(
        i["code"] == "STRICT_BUDGET_UNVERIFIED" and i["blocking"]
        for i in report["issues"]
    )


def replace_costs(client, base, path, costs):
    version = client.get(path)
    return client.post(
        base + "/draft/commands",
        headers={"If-Match": version.headers["etag"]},
        json={"commands": [{"type": "cost.replace_records", "costs": costs}]},
    )


def test_linked_costs_freeze_into_review_copy_on_accept_and_survive_removal(context):
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    draft = client.get(path).json()["data"]
    activity = draft["activities"][0]["logical_id"]
    paid = record(
        category="activity",
        label="Tickets",
        activity_id=activity,
        status="paid",
        amount="99.99",
        unit="per_group",
        quantity=1,
    )
    guess = record(category="activity", label="Guide", activity_id=activity)
    saved = replace_costs(client, base, path, [paid, guess])
    assert saved.status_code == 200, saved.text
    costs = client.get(path).json()["data"]["costs"]
    assert [c["label"] for c in costs] == ["Tickets", "Guide"]
    assert costs[0]["activity_id"] == activity and costs[1]["amount"] == "12.50"
    # Settings autosave alone never touches costs.
    version = client.get(path)
    changes = {
        k: v for k, v in version.json()["data"].items() if k in PlanInput.model_fields
    }
    changes.update(stops=[], activities=[], costs=[])
    unrelated = client.post(
        base + "/draft/commands",
        headers={"If-Match": version.headers["etag"]},
        json={"commands": [{"type": "plan.update_settings", "changes": changes}]},
    )
    assert unrelated.status_code == 200, unrelated.text
    assert client.get(path).json()["data"]["costs"] == costs
    proposal = test_proposals.submit(client, base, unrelated.headers["etag"]).json()[
        "data"
    ]
    frozen = base + f"/versions/{proposal['candidate_version_id']}"
    assert client.get(frozen).json()["data"]["costs"] == costs
    linked = client.get(frozen + "/budget").json()["data"]["records"]
    assert [r["linked_to"] for r in linked] == ["Walk", "Walk"]
    accepted = test_proposals.accept(client, base, proposal)
    assert accepted.status_code == 200, accepted.text
    current = client.get(base).json()["data"]["current_version_id"]
    assert client.get(base + f"/versions/{current}").json()["data"]["costs"] == costs
    # Removing the activity from the draft drops its estimate but keeps the
    # payment, unlinked and flagged; the accepted snapshot is untouched.
    version = client.get(path)
    removed = client.post(
        base + "/draft/commands",
        headers={"If-Match": version.headers["etag"]},
        json={
            "commands": [{"type": "activity.replace_user_schedule", "activities": []}]
        },
    )
    assert removed.status_code == 200, removed.text
    left = client.get(path).json()["data"]["costs"]
    assert [(c["label"], c["link_removed"], c["activity_id"]) for c in left] == [
        ("Tickets", True, None)
    ]
    budget = client.get(path + "/budget").json()["data"]
    assert budget["recorded_paid_subtotal"] == "99.99"
    assert client.get(base + f"/versions/{current}").json()["data"]["costs"] == costs
    assert client.get(frozen).json()["data"]["costs"] == costs

    restored = test_revisions.restore(client, base, current, removed.headers["etag"])
    assert restored.status_code == 202, restored.text
    review = restored.json()["data"]
    assert client.get(path).json()["data"]["costs"] == left
    accepted = test_proposals.accept(client, base, review)
    assert accepted.status_code == 200, accepted.text
    new_snapshot = review["candidate_version_id"]
    assert new_snapshot != current
    for endpoint in (path, f"{base}/versions/{new_snapshot}", frozen):
        assert client.get(endpoint).json()["data"]["costs"] == costs


def test_cost_commands_reject_duplicates_and_settings_cannot_smuggle_costs(context):
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    entry = record()
    assert replace_costs(client, base, path, [entry, entry]).status_code == 422
    version = client.get(path)
    changes = {
        k: v for k, v in version.json()["data"].items() if k in PlanInput.model_fields
    }
    changes.update(stops=[], activities=[], costs=[entry])
    smuggled = client.post(
        base + "/draft/commands",
        headers={"If-Match": version.headers["etag"]},
        json={"commands": [{"type": "plan.update_settings", "changes": changes}]},
    )
    assert smuggled.status_code == 422
    assert client.get(path).json()["data"]["costs"] == []


def test_journey_costs_follow_route_changes_like_other_links():
    from app.trips.schemas import plan_legs

    plan = fixture()
    legs = plan_legs(plan)
    first, back = legs[0]["key"], legs[-1]["key"]
    plan = with_records(
        plan,
        [
            record(
                category="transport",
                label="Train",
                leg_key=first,
                status="paid",
                amount="30",
                unit="per_person",
                quantity=1,
            ),
            record(
                category="transport",
                label="Taxi home",
                leg_key=back,
                unit="per_group",
                quantity=1,
                amount="8",
            ),
        ],
    )
    rows = project_costs(plan, uuid4()).records
    assert [r.linked_to for r in rows] == ["Delhi → Same city", "Same city → Delhi"]
    # A one-way trip has no journey home: that estimate goes, nothing else changes.
    data = plan.model_dump(mode="json")
    data["preferences"]["return_to_origin"] = False
    one_way = PlanInput.model_validate(data)
    assert [(c.label, c.leg_key) for c in one_way.costs] == [("Train", first)]
    # A new starting point changes the first journey: the paid ticket is kept.
    data["origin"] = {"label": "Mumbai"}
    moved = PlanInput.model_validate(data)
    assert [(c.label, c.link_removed, c.leg_key) for c in moved.costs] == [
        ("Train", True, None)
    ]
    with pytest.raises(ValueError):
        with_records(fixture(), [record(leg_key=first, stop_id=str(uuid4()))])


def test_draft_origin_change_unlinks_paid_journey_cost(context):
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    draft = client.get(path).json()["data"]
    stop = client.get(path + "/stops").json()["data"][0]
    fields = {k: v for k, v in draft.items() if k in PlanInput.model_fields}
    fields["stops"] = [
        dict(
            client_id=stop["logical_item_id"],
            name=stop["name"],
            timezone=stop["timezone"],
        )
    ]
    plan = PlanInput.model_validate(fields)
    from app.trips.schemas import plan_legs

    key = plan_legs(plan)[0]["key"]
    assert stop["logical_item_id"] in key
    paid = record(
        category="transport",
        label="Train",
        leg_key=key,
        status="paid",
        amount="30",
        unit="per_group",
        quantity=1,
    )
    guess = record(category="transport", label="Snacks", leg_key=key)
    assert replace_costs(client, base, path, [paid, guess]).status_code == 200
    linked = client.get(path + "/budget").json()["data"]["records"]
    assert linked[0]["linked_to"] and "→" in linked[0]["linked_to"]
    # A settings-only save that moves the starting point changes the journey.
    version = client.get(path)
    changes = {
        k: v for k, v in version.json()["data"].items() if k in PlanInput.model_fields
    }
    changes.update(stops=[], activities=[], costs=[], origin={"label": "Elsewhere"})
    moved = client.post(
        base + "/draft/commands",
        headers={"If-Match": version.headers["etag"]},
        json={"commands": [{"type": "plan.update_settings", "changes": changes}]},
    )
    assert moved.status_code == 200, moved.text
    left = client.get(path).json()["data"]["costs"]
    assert [(c["label"], c["link_removed"], c["leg_key"]) for c in left] == [
        ("Train", True, None)
    ]


def test_foreign_costs_convert_only_with_an_entered_rate():
    plan = with_records(
        fixture(),
        [
            record(
                label="Museum",
                currency="EUR",
                amount="10",
                unit="per_group",
                quantity=1,
                conversion_rate="90.125",
                rate_note="Bank, 14 Nov",
                rate_date="2026-11-14",
            ),
            record(
                label="Hostel deposit",
                currency="EUR",
                amount="20",
                unit="per_group",
                quantity=1,
                status="paid",
            ),
            record(
                label="Same currency",
                currency="INR",
                amount="5",
                unit="per_group",
                quantity=1,
            ),
        ],
        {"amount": "1000", "mode": "target"},
    )
    coverage = project_costs(plan, uuid4())
    museum, deposit, same = coverage.records
    # 10.00 EUR × 90.125 = 901.25 INR, half-up to whole cents.
    assert (museum.amount, museum.conversion, museum.currency) == (
        Decimal("901.25"),
        "converted",
        "EUR",
    )
    assert museum.original_amount == Decimal("10.00") and museum.rate_note
    # A paid foreign amount without a rate stays unknown in trip totals.
    assert deposit.amount is None and deposit.conversion == "missing_rate"
    assert deposit.entered_status == "paid" and deposit.amount_status == "unknown"
    assert deposit.original_amount == Decimal("20.00")
    assert same.conversion == "none" and same.amount == Decimal("5.00")
    assert coverage.recorded_paid_subtotal == 0 and coverage.unconverted_records == 1
    assert coverage.estimated_subtotal == Decimal("925.93")
    for bad in [
        record(conversion_rate="2"),
        record(currency="EUR", conversion_rate="0"),
        record(currency="eur"),
        record(rate_note="x"),
    ]:
        with pytest.raises(ValueError):
            with_records(fixture(), [bad])


def test_currency_and_rate_survive_storage_and_review(context):
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    entry = record(
        currency="EUR",
        conversion_rate="90.125",
        rate_note="Bank",
        rate_date="2026-11-14",
        unit="per_group",
        quantity=1,
    )
    assert replace_costs(client, base, path, [entry]).status_code == 200
    saved = client.get(path).json()["data"]["costs"][0]
    assert {
        k: saved[k] for k in ("currency", "conversion_rate", "rate_note", "rate_date")
    } == {
        "currency": "EUR",
        "conversion_rate": "90.125",
        "rate_note": "Bank",
        "rate_date": "2026-11-14",
    }
    row = client.get(path + "/budget").json()["data"]["records"][0]
    assert row["amount"] == "1126.56" and row["conversion"] == "converted"


def test_tax_is_added_only_when_known_and_never_assumed_zero():
    plan = with_records(
        fixture(),
        [
            record(
                label="Hotel",
                unit="per_group",
                quantity=2,
                amount="100",
                tax_status="excluded",
                tax_percent="12",
            ),
            record(
                label="Tour",
                unit="per_group",
                quantity=1,
                amount="50",
                tax_status="excluded",
            ),
            record(
                label="Dinner",
                unit="per_group",
                quantity=1,
                amount="30",
                tax_status="included",
            ),
            record(
                label="City tax",
                category="taxes_fees",
                unit="per_person",
                quantity=2,
                amount="1.5",
                tax_status="included",
            ),
            record(
                label="Museum",
                currency="EUR",
                conversion_rate="90",
                amount="10",
                unit="per_group",
                quantity=1,
                tax_status="excluded",
                tax_percent="5.5",
            ),
        ],
    )
    coverage = project_costs(plan, uuid4())
    hotel, tour, dinner, city, museum = coverage.records
    assert hotel.tax_amount == Decimal("24.00") and hotel.amount == Decimal("224.00")
    assert tour.amount == Decimal("50.00") and not tour.tax_known
    assert dinner.tax_known and city.amount == Decimal("9.00")
    # 10.00 EUR + 5.5% = 10.55 EUR (tax in the original currency) → 949.50 INR.
    assert museum.tax_amount == Decimal("0.55") and museum.amount == Decimal("949.50")
    assert coverage.tax_unknown_records == 1
    assert "Taxes and fees" not in coverage.unpriced_categories
    for bad in [
        record(tax_percent="5"),
        record(tax_status="included", tax_percent="5"),
        record(tax_status="excluded", tax_percent="101"),
        record(tax_status="maybe"),
    ]:
        with pytest.raises(ValueError):
            with_records(fixture(), [bad])


def test_tax_fields_survive_storage(context):
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    entry = record(
        category="taxes_fees",
        label="Booking fee",
        unit="per_group",
        quantity=1,
        amount="10",
        tax_status="excluded",
        tax_percent="18",
    )
    assert replace_costs(client, base, path, [entry]).status_code == 200
    saved = client.get(path).json()["data"]["costs"][0]
    assert (saved["tax_status"], saved["tax_percent"]) == ("excluded", "18")
    row = client.get(path + "/budget").json()["data"]["records"][0]
    assert (row["tax_amount"], row["amount"]) == ("1.80", "11.80")


def test_partial_version_reads_preserve_stay_and_journey_links(context):
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    stops = client.get(path + "/stops").json()["data"]
    stop_id = stops[0]["logical_item_id"]
    from app.trips.schemas import route_legs

    overview = client.get(path).json()["data"]
    legs = route_legs(
        (overview.get("origin") or {}).get("label", ""),
        overview["preferences"].get("return_to_origin", True),
        (overview.get("return_location") or {}).get("label", ""),
        [(s["logical_item_id"], s["name"]) for s in stops],
    )
    entries = [
        record(category="accommodation", stop_id=stop_id),
        record(category="transport", leg_key=legs[0]["key"], status="paid"),
    ]
    assert replace_costs(client, base, path, entries).status_code == 200
    for _ in range(2):
        response = client.get(path)
        assert response.status_code == 200
        costs = response.json()["data"]["costs"]
        assert len(costs) == 2
        assert costs[0]["stop_id"] == stop_id
        assert costs[1]["leg_key"] == legs[0]["key"]
        assert all(not c["link_removed"] for c in costs)
        assert replace_costs(client, base, path, costs).status_code == 200


def complete_plan(budget, **record_changes):
    plan = fixture()
    data = plan.model_dump(mode="json")
    # Price the one unpriced journey so every allowance is known.
    from app.trips.schemas import plan_legs

    for leg in plan_legs(plan):
        data["preferences"]["travel_preferences"].setdefault(
            leg["key"],
            dict(mode="bus", hours="", overnight=0, rate="1", basis="vehicle"),
        )
    data["preferences"]["costs_confirmed"] = True
    data["costs"] = [record(**{"tax_status": "included", **record_changes})]
    data["budget"] = {"amount": budget, "mode": "strict"}
    return PlanInput.model_validate(data)


@pytest.mark.parametrize("rate,tax", [("90", "10"), ("100", "0"), ("0.0000001", "100")])
def test_plain_decimal_rates_survive_serialization_and_storage(context, rate, tax):
    from app.trips.schemas import CostInput

    entry = record(
        currency="EUR", conversion_rate=rate, tax_status="excluded", tax_percent=tax
    )
    parsed = CostInput.model_validate(entry)
    assert CostInput.model_validate(parsed.model_dump(mode="json")) == parsed
    client, _, _ = context
    base, trip, _ = test_proposals.setup(client)
    path = base + f"/versions/{trip['draft_version_id']}"
    assert replace_costs(client, base, path, [entry]).status_code == 200
    result = client.get(path)
    assert result.status_code == 200
    saved = result.json()["data"]["costs"][0]
    assert Decimal(saved["conversion_rate"]) == Decimal(rate)
    assert Decimal(saved["tax_percent"]) == Decimal(tax)
    assert "E" not in saved["conversion_rate"]
    assert "E" not in saved["tax_percent"]
    assert client.get(path + "/budget").status_code == 200


@pytest.mark.parametrize(
    "record_amount,expected", [("40", "100"), ("100", "100"), ("120", "120")]
)
def test_linked_stay_payment_offsets_allowance_once(record_amount, expected):
    data = complete_plan("1000").model_dump(mode="json")
    stop = data["stops"][0]["client_id"]
    data["stops"][0]["desired_nights"] = 1
    data["stops"][1]["desired_nights"] = 0
    data["room_count"] = 1
    data["preferences"]["stay_preferences"][stop]["rate"] = "100"
    for leg in data["preferences"]["travel_preferences"].values():
        leg["rate"] = "0"
    data["costs"] = [
        record(
            category="accommodation",
            stop_id=stop,
            amount=record_amount,
            unit="per_group",
            quantity=1,
            status="paid",
            tax_status="included",
        )
    ]
    report = project_costs(PlanInput.model_validate(data), uuid4())
    assert report.total == Decimal(expected)
    assert report.recorded_paid_subtotal == Decimal(record_amount)
    assert report.estimated_subtotal == max(Decimal("100") - Decimal(record_amount), 0)
    # A different expense category is an extra, even when associated with a stay.
    data["costs"][0]["category"] = "miscellaneous"
    extra = project_costs(PlanInput.model_validate(data), uuid4())
    assert extra.total == Decimal("100") + Decimal(record_amount)


def strict_codes(plan):
    from app.planning.validation import validate_plan

    return {
        i["code"]: i["blocking"]
        for i in validate_plan(plan)["issues"]
        if i["code"].startswith("STRICT")
    }


def test_journey_payment_and_estimate_share_the_matching_allowance():
    from app.trips.schemas import plan_legs

    data = complete_plan("1000").model_dump(mode="json")
    for stop in data["stops"]:
        stop["desired_nights"] = 0
    key = plan_legs(PlanInput.model_validate(data))[0]["key"]
    for leg in data["preferences"]["travel_preferences"].values():
        leg["rate"] = "0"
    data["preferences"]["travel_preferences"][key].update(rate="100", basis="vehicle")
    data["costs"] = [
        record(
            category="transport",
            leg_key=key,
            amount="40",
            status="paid",
            unit="per_group",
            quantity=1,
            tax_status="included",
        ),
        record(
            category="transport",
            leg_key=key,
            amount="60",
            unit="per_group",
            quantity=1,
            tax_status="included",
        ),
    ]
    coverage = project_costs(PlanInput.model_validate(data), uuid4())
    assert coverage.total == Decimal("100")
    assert coverage.recorded_paid_subtotal == Decimal("40")
    assert coverage.estimated_subtotal == Decimal("60")
    data["costs"].append(
        record(
            category="taxes_fees",
            leg_key=key,
            amount="10",
            unit="per_group",
            quantity=1,
            tax_status="included",
        )
    )
    assert project_costs(PlanInput.model_validate(data), uuid4()).total == Decimal(
        "110"
    )


def test_strict_budget_is_checked_only_when_every_cost_is_known_and_confirmed():
    within = complete_plan("1000")
    coverage = project_costs(within, uuid4())
    # 19.68 allowances + 1.00 journey + 150.00 dinners.
    assert coverage.coverage_complete and coverage.total == Decimal("170.68")
    assert coverage.missing == []
    assert strict_codes(within) == {"STRICT_BUDGET_FROM_ENTRIES": False}
    assert strict_codes(complete_plan("170.67")) == {"STRICT_BUDGET_EXCEEDED": True}
    assert strict_codes(complete_plan("170.68")) == {
        "STRICT_BUDGET_FROM_ENTRIES": False
    }
    for gap in [
        dict(amount=""),
        dict(tax_status="unknown"),
        dict(currency="EUR"),
        dict(tax_status="excluded"),
    ]:
        plan = complete_plan("1000", **gap)
        assert not project_costs(plan, uuid4()).coverage_complete
        assert strict_codes(plan) == {"STRICT_BUDGET_UNVERIFIED": True}
    data = within.model_dump(mode="json")
    data["preferences"]["costs_confirmed"] = False
    unconfirmed = PlanInput.model_validate(data)
    assert "Confirm that you have entered every cost for this trip." in (
        project_costs(unconfirmed, uuid4()).missing
    )
    assert project_costs(unconfirmed, uuid4()).total is None


def test_restore_requires_acknowledgement_before_removing_new_payment(context):
    client, _, _ = context
    base, trip, tag = test_proposals.setup(client)
    original = test_proposals.submit(client, base, tag).json()["data"]
    assert test_proposals.accept(client, base, original).status_code == 200
    path = base + f"/versions/{trip['draft_version_id']}"
    paid = record(label="Paid museum ticket", status="paid")
    saved = replace_costs(client, base, path, [paid])
    assert saved.status_code == 200, saved.text

    response = test_revisions.restore(
        client, base, original["candidate_version_id"], saved.headers["etag"]
    )
    assert response.status_code == 202, response.text
    proposal = response.json()["data"]
    issue = next(
        issue
        for issue in proposal["validation"]["issues"]
        if issue["code"] == "RESTORE_PAID_COSTS"
    )
    assert "Paid museum ticket" in issue["detail"]
    assert issue["acknowledgeable"]
    blocked = client.post(
        base + f"/proposals/{proposal['id']}/accept",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "expected_current_version_id": proposal["base_current_version_id"],
            "acknowledged_issue_ids": [
                other["id"]
                for other in proposal["validation"]["issues"]
                if other["acknowledgeable"] and other["id"] != issue["id"]
            ],
        },
    )
    assert blocked.json()["code"] == "ACKNOWLEDGEMENT_REQUIRED"
    assert client.get(path).json()["data"]["costs"][0]["id"] == paid["id"]
    updated = replace_costs(client, base, path, [{**paid, "amount": "24.50"}])
    assert updated.status_code == 200, updated.text
    stale = test_proposals.accept(client, base, proposal)
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "STALE_PROPOSAL"
    assert client.get(path).json()["data"]["costs"][0]["amount"] == "24.50"
    fresh = test_revisions.restore(
        client, base, original["candidate_version_id"], updated.headers["etag"]
    )
    assert fresh.status_code == 202, fresh.text
    assert test_proposals.accept(client, base, fresh.json()["data"]).status_code == 200
    assert client.get(path).json()["data"]["costs"] == []


@pytest.mark.parametrize(
    ("currency", "rate", "warn"),
    [(None, None, True), ("EUR", None, False), ("EUR", "1.25", True)],
)
def test_restore_checks_currency_context_of_identical_paid_records(
    currency, rate, warn
):
    from app.planning.restoration import restoration_report

    saved = with_records(
        fixture(), [record(status="paid", currency=currency, conversion_rate=rate)]
    )
    restored = saved.model_copy(update={"display_currency": "GBP"})
    assert saved.display_currency != restored.display_currency
    issues = restoration_report(saved, restored)["issues"]
    assert any(issue["code"] == "RESTORE_PAID_COSTS" for issue in issues) == warn


@pytest.mark.parametrize(("unit", "warn"), [("per_person", True), ("per_group", False)])
def test_restore_checks_traveler_count_for_identical_paid_records(unit, warn):
    from app.planning.restoration import restoration_report

    saved = with_records(fixture(), [record(status="paid", unit=unit)])
    restored = saved.model_copy(update={"traveler_count": saved.traveler_count + 1})
    issues = restoration_report(saved, restored)["issues"]
    assert any(issue["code"] == "RESTORE_PAID_COSTS" for issue in issues) == warn
