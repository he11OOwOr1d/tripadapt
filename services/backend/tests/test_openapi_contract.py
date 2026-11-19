import json
from pathlib import Path

from app.main import app


def test_generated_openapi_matches_backend():
    snapshot = Path(__file__).resolve().parents[1] / "openapi.json"
    assert json.loads(snapshot.read_text()) == app.openapi(), (
        "Run make openapi from the repository root to regenerate the snapshot."
    )
