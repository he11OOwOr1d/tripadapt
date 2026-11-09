from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.main import app
from app.persistence.database import engine


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def test_liveness(client):
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"
    assert response.headers["x-request-id"] == response.json()["meta"]["request_id"]


def test_readiness_reads_migrated_postgres(client):
    with engine.connect() as connection:
        marker = connection.execute(
            text("SELECT initialized_at FROM system_probe WHERE id = 1")
        ).scalar_one()
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["data"]["database"] == "connected"
    assert response.json()["data"]["initialized_at"] == marker.isoformat()


def test_database_failure_is_safe_503(client, monkeypatch):
    @contextmanager
    def broken_connection():
        raise OperationalError(
            "secret connection details", {}, Exception("credentials")
        )
        yield

    monkeypatch.setattr(engine, "connect", broken_connection)
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["code"] == "DATABASE_NOT_READY"
    assert "credentials" not in response.text
    assert client.get("/api/v1/health/live").status_code == 200


def test_browser_origin_allowed(client):
    response = client.get(
        "/api/v1/health/ready", headers={"Origin": "http://localhost:3000"}
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    response = client.get(
        "/api/v1/health/live", headers={"Origin": "https://untrusted.example"}
    )
    assert "access-control-allow-origin" not in response.headers
