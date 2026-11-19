import pytest
import test_proposals


@pytest.fixture
def context():
    yield from test_proposals.context.__wrapped__()


def test_strict_budget_draft_persists_but_cannot_be_accepted_without_complete_costs(
    context,
):
    client, _, _ = context
    trip = client.post(
        "/api/v1/trips",
        json={
            "title": "Strict budget safety",
            "plan": {"budget": {"amount": "15000", "mode": "strict"}},
        },
    ).json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    draft_path = base + f"/versions/{trip['draft_version_id']}"
    draft = client.get(draft_path)
    assert draft.json()["data"]["budget"]["mode"] == "strict"
    proposal = test_proposals.submit(client, base, draft.headers["etag"]).json()["data"]
    assert any(
        issue["blocking"] and issue["code"] == "STRICT_BUDGET_UNVERIFIED"
        for issue in proposal["validation"]["issues"]
    )
    before = client.get(base).json()["data"]
    response = test_proposals.accept(client, base, proposal)
    assert response.status_code == 409
    assert response.json()["code"] == "PLAN_CONFLICT"
    assert client.get(base).json()["data"] == before
    assert client.get(draft_path).json()["data"]["budget"]["mode"] == "strict"


def strict_trip(client, budget):
    from uuid import uuid4

    stop = str(uuid4())
    key = '["origin:","%s"]' % stop
    back = '["%s","finish:"]' % stop
    trip = client.post(
        "/api/v1/trips",
        json={
            "title": "Complete strict budget",
            "plan": {
                "budget": {"amount": budget, "mode": "strict"},
                "stops": [
                    dict(
                        client_id=stop,
                        name="Jaipur",
                        timezone="Asia/Kolkata",
                        desired_nights=2,
                    )
                ],
                "preferences": {
                    "costs_confirmed": True,
                    "stay_preferences": {
                        stop: dict(style="hotel", rate="100", basis="room")
                    },
                    "travel_preferences": {
                        k: dict(
                            mode="bus",
                            hours="",
                            overnight=0,
                            rate="10",
                            basis="vehicle",
                        )
                        for k in (key, back)
                    },
                },
                "costs": [
                    dict(
                        id=str(uuid4()),
                        category="food",
                        label="Meals",
                        unit="per_group",
                        quantity=1,
                        amount="50",
                        status="estimated",
                        tax_status="included",
                    )
                ],
            },
        },
    )
    assert trip.status_code == 201, trip.text
    trip = trip.json()["data"]
    base = f"/api/v1/trips/{trip['id']}"
    draft = client.get(base + f"/versions/{trip['draft_version_id']}")
    return base, draft.headers["etag"]


def test_complete_strict_budget_is_accepted_only_within_the_limit(context):
    client, _, _ = context
    # 2 room-nights × 100 + 2 journeys × 10 + 50 meals = 270.
    base, tag = strict_trip(client, "270")
    proposal = test_proposals.submit(client, base, tag).json()["data"]
    codes = {i["code"]: i for i in proposal["validation"]["issues"]}
    assert "STRICT_BUDGET_UNVERIFIED" not in codes
    advisory = codes["STRICT_BUDGET_FROM_ENTRIES"]
    assert not advisory["blocking"] and "270.00" in advisory["detail"]
    # Accepting requires acknowledging that the check is against your entries.
    refused = test_proposals.accept(client, base, proposal, ack=False)
    assert refused.status_code != 200
    accepted = test_proposals.accept(client, base, proposal)
    assert accepted.status_code == 200, accepted.text
    over, tag = strict_trip(client, "269.99")
    proposal = test_proposals.submit(client, over, tag).json()["data"]
    assert any(
        i["blocking"] and i["code"] == "STRICT_BUDGET_EXCEEDED"
        for i in proposal["validation"]["issues"]
    )
    assert test_proposals.accept(client, over, proposal).status_code == 409
