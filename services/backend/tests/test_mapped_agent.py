import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
import test_activity_discovery
import test_day_graph
import test_trips

from app.agents.day_graph import run_day_graph
from app.agents.groq_provider import PlanningFailure
from app.agents.place_evidence import BREAKS, catalog_from_ids, gather_places
from app.api import places
from app.config import settings
from app.persistence.models import DiscoveredPlace
from app.planning.candidate import validate_job_candidate
from app.providers.activities import DiscoveryFailure
from app.trips.schemas import PlanInput


@pytest.fixture
def context():
    yield from test_trips.context.__wrapped__()


def evidence(context, monkeypatch):
    client, db, _ = context
    destination, place = test_activity_discovery.discovered(client, monkeypatch)
    stop = str(uuid4())
    plan = PlanInput.model_validate(
        {
            "stops": [
                {
                    "client_id": stop,
                    "name": destination["label"],
                    "timezone": destination["timezone"],
                    "place_reference_id": destination["reference_id"],
                    "desired_nights": 3,
                }
            ]
        }
    )
    return db, plan, stop, place


def output(place_id):
    return json.dumps(
        {
            "summary": "A mapped museum, with estimated visiting time.",
            "additions": [
                {
                    "candidate_id": f"place:{place_id}",
                    "start": "10:00",
                    "reason": "A retrieved museum record; check opening hours before visiting.",
                }
            ],
        }
    )


def test_real_catalog_is_grounded_and_checked_again_at_accept_boundary(
    context, monkeypatch
):
    db, plan, stop, place = evidence(context, monkeypatch)
    catalog = catalog_from_ids(db, plan.stops[0], [place["id"]])
    ident = uuid4()
    candidate, metadata = run_day_graph(
        plan,
        stop,
        0,
        ident,
        test_day_graph.FakeProvider([output(place["id"])]),
        place_catalog=catalog,
        place_ids=[place["id"]],
    )
    assert metadata["evidence"] == "mapped_places"
    assert candidate.activities[0].place_id == UUID(place["id"])
    assert candidate.activities[0].user_label == place["name"]
    assert candidate.activities[0].duration_minutes == 60
    payload = {
        "plan": plan.model_dump(mode="json"),
        "request": {
            "operation": "generate",
            "engine": "groq",
            "evidence": "places",
            "scope": {"stop_logical_id": stop, "local_day_offset": 0},
        },
    }
    assert (
        validate_job_candidate(payload, candidate, ident, metadata, db=db)["code"]
        == "AI_MAPPED_PLACES"
    )
    changed = candidate.model_copy(deep=True)
    changed.activities[0].user_label = "Invented landmark"
    with pytest.raises(ValueError):
        validate_job_candidate(payload, changed, ident, metadata, db=db)
    with pytest.raises(ValueError):
        validate_job_candidate(
            payload, candidate, ident, {**metadata, "place_ids": [str(uuid4())]}, db=db
        )
    with pytest.raises(ValueError):
        validate_job_candidate(
            payload, candidate, ident, {**metadata, "evidence": "sample_catalog"}, db=db
        )


def test_model_cannot_invent_place_id_even_when_output_is_valid_json(
    context, monkeypatch
):
    db, plan, stop, place = evidence(context, monkeypatch)
    catalog = catalog_from_ids(db, plan.stops[0], [place["id"]])
    wrong = output(uuid4())
    with pytest.raises(PlanningFailure, match="AI_CANDIDATE_INVALID"):
        run_day_graph(
            plan,
            stop,
            0,
            uuid4(),
            test_day_graph.FakeProvider([wrong, wrong]),
            place_catalog=catalog,
            place_ids=[place["id"]],
        )


def test_wrong_destination_and_expired_evidence_are_rejected(context, monkeypatch):
    db, plan, _, place = evidence(context, monkeypatch)
    wrong = plan.stops[0].model_copy(update={"place_reference_id": uuid4()})
    with pytest.raises(ValueError):
        catalog_from_ids(db, wrong, [place["id"]])
    stale = DiscoveredPlace(
        id=uuid4(),
        destination_reference_id=plan.stops[0].place_reference_id,
        payload={
            **{
                k: v
                for k, v in place.items()
                if k not in ("id", "destination_reference_id")
            },
            "retrieved_at": (
                datetime.now(timezone.utc) - timedelta(days=2)
            ).isoformat(),
        },
    )
    db.add(stale)
    db.flush()
    with pytest.raises(ValueError, match="refresh"):
        catalog_from_ids(db, plan.stops[0], [str(stale.id)])


def test_missing_location_or_provider_failure_never_substitutes_samples(
    context, monkeypatch
):
    db, plan, _, _ = evidence(context, monkeypatch)
    manual = plan.stops[0].model_copy(update={"place_reference_id": None})
    with pytest.raises(PlanningFailure, match="AI_LOCATION_REQUIRED"):
        gather_places(db, manual, ["culture"], lambda stage: None)

    class Failed:
        def search(self, *args):
            raise DiscoveryFailure("ACTIVITY_PROVIDER_UNAVAILABLE")

    monkeypatch.setattr(places, "activity_discovery", Failed())
    with pytest.raises(PlanningFailure, match="ACTIVITY_PROVIDER_UNAVAILABLE"):
        gather_places(db, plan.stops[0], ["culture"], lambda stage: None)
    # A requested break is honestly an estimate and does not require a place search.
    catalog, ids = gather_places(db, manual, ["rest"], lambda stage: None)
    assert ids == [] and catalog == [BREAKS[1]]
    monkeypatch.setattr(settings, "activity_search_enabled", False)
    with pytest.raises(PlanningFailure, match="ACTIVITY_SEARCH_DISABLED"):
        gather_places(db, plan.stops[0], ["culture"], lambda stage: None)


def test_mapped_job_publication_and_acceptance_use_retained_place_records(
    context, monkeypatch
):
    import test_proposals
    from pydantic import SecretStr
    from sqlalchemy import select

    from app.jobs.worker import claim, publish
    from app.persistence.models import AppUser

    db, plan, stop, place = evidence(context, monkeypatch)
    client, _, identity = context
    db.commit()
    monkeypatch.setattr(settings, "planning_ai_enabled", True)
    monkeypatch.setattr(settings, "groq_api_key", SecretStr("test-only"))
    created = client.post(
        "/api/v1/trips",
        json={"title": "Mapped AI integration", "plan": plan.model_dump(mode="json")},
    ).json()["data"]
    base = f"/api/v1/trips/{created['id']}"
    loaded = client.get(f"{base}/versions/{created['draft_version_id']}")
    response = client.post(
        base + "/planning-jobs",
        headers={"If-Match": loaded.headers["etag"], "Idempotency-Key": str(uuid4())},
        json={
            "operation": "generate",
            "engine": "groq",
            "evidence": "places",
            "base_version_id": created["draft_version_id"],
            "scope": {
                "type": "selected_day",
                "stop_logical_id": stop,
                "local_day_offset": 0,
            },
        },
    )
    assert response.status_code == 202, response.text
    assert response.json()["data"]["evidence"] == "places"
    owner = db.scalar(
        select(AppUser.id).where(AppUser.auth_subject == identity.subject)
    )
    job = claim(db, owner_id=owner)
    ident, token = job.id, job.lease_token
    catalog = catalog_from_ids(db, plan.stops[0], [place["id"]])
    candidate, metadata = run_day_graph(
        plan,
        stop,
        0,
        ident,
        test_day_graph.FakeProvider([output(place["id"])]),
        place_catalog=catalog,
        place_ids=[place["id"]],
    )
    assert publish(db, ident, token, candidate, metadata)
    proposal_id = job.proposal_id
    db.commit()
    proposal = client.get(base + f"/proposals/{proposal_id}").json()["data"]
    assert proposal["generation"]["evidence"] == "mapped_places"
    assert proposal["place_details"][place["id"]]["name"] == place["name"]
    assert test_proposals.accept(client, base, proposal).status_code == 200
