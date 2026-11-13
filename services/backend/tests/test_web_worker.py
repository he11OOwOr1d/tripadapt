import threading

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.jobs import service
from app.main import app


def test_web_lifespan_runs_worker_and_stops_it(monkeypatch):
    attempted = threading.Event()
    monkeypatch.setattr(settings, "planning_worker_embedded", True)
    monkeypatch.setattr(settings, "planning_fixtures_enabled", True)
    monkeypatch.setattr(settings, "planning_ai_enabled", False)
    monkeypatch.setattr(service, "run_once", lambda: attempted.set() or False)
    with TestClient(app) as client:
        assert attempted.wait(2)
        worker = app.state.planning_worker
        assert worker.alive
        assert client.get("/api/v1/health/live").status_code == 200
        assert client.get("/api/v1/trips").status_code == 401
    assert not worker.alive


def test_serverless_default_does_not_start_worker(monkeypatch):
    monkeypatch.setattr(settings, "planning_worker_embedded", False)

    def forbidden():
        pytest.fail("Serverless mode must not consume the job queue")

    monkeypatch.setattr(service, "run_once", forbidden)
    with TestClient(app) as client:
        assert app.state.planning_worker is None
        assert client.get("/api/v1/health/live").status_code == 200


def test_queue_outage_retries_without_exposing_credentials(monkeypatch, caplog):
    worker = service.WebServiceWorker()
    waits = []
    calls = []

    def attempt():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("private-database-password")
        worker.stopped.set()
        return True

    monkeypatch.setattr(service, "run_once", attempt)
    monkeypatch.setattr(worker.stopped, "wait", lambda delay: waits.append(delay))
    worker._run()
    assert len(calls) == 2
    assert waits == [15]
    assert "private-database-password" not in caplog.text


def test_disabled_engines_fail_startup(monkeypatch):
    monkeypatch.setattr(settings, "planning_ai_enabled", False)
    monkeypatch.setattr(settings, "planning_fixtures_enabled", False)
    with pytest.raises(RuntimeError, match="Enable a planning engine"):
        service.WebServiceWorker().start()


def test_readiness_fails_if_worker_stops(monkeypatch):
    monkeypatch.setattr(settings, "planning_worker_embedded", False)
    with TestClient(app) as client:
        monkeypatch.setattr(settings, "planning_worker_embedded", True)
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 503
        assert response.json()["code"] == "PLANNING_WORKER_UNAVAILABLE"
