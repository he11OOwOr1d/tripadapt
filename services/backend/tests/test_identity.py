from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

from app.api import identity
from app.config import settings


@pytest.fixture
def signed(monkeypatch):
    private = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(settings, "supabase_url", "https://test.supabase.co")
    monkeypatch.setattr(
        identity,
        "signing_keys",
        lambda _: SimpleNamespace(
            get_signing_key_from_jwt=lambda token: SimpleNamespace(
                key=private.public_key()
            )
        ),
    )
    now = datetime.now(timezone.utc)
    claims = dict(
        iss="https://test.supabase.co/auth/v1",
        aud="authenticated",
        sub=str(uuid4()),
        email="Traveler@example.org",
        role="authenticated",
        iat=now,
        exp=now + timedelta(minutes=5),
        user_metadata={"role": "service_role", "email_verified": True},
    )
    return private, claims


def test_verified_identity_ignores_user_controlled_metadata(signed):
    private, claims = signed
    result = identity.verify_token(jwt.encode(claims, private, algorithm="ES256"))
    assert result.subject == claims["sub"]
    assert result.email_normalized == "traveler@example.org"
    assert result.email_verified is False


@pytest.mark.parametrize(
    "changes",
    [
        {"iss": "https://attacker.example/auth/v1"},
        {"aud": "another-app"},
        {"exp": 0},
        {"role": "service_role"},
        {"is_anonymous": True},
        {"sub": "invented"},
        {"email": None},
    ],
)
def test_invalid_claims_fail_closed(signed, changes):
    private, claims = signed
    with pytest.raises(HTTPException) as error:
        identity.verify_token(
            jwt.encode({**claims, **changes}, private, algorithm="ES256")
        )
    assert error.value.status_code == 401


def test_forged_signature_rejected(signed):
    _, claims = signed
    attacker = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(HTTPException) as error:
        identity.verify_token(jwt.encode(claims, attacker, algorithm="ES256"))
    assert error.value.status_code == 401


def test_missing_provider_configuration_is_not_reported_as_bad_session(monkeypatch):
    from fastapi.security import HTTPAuthorizationCredentials

    monkeypatch.setattr(settings, "supabase_url", "")
    with pytest.raises(HTTPException) as error:
        identity.verified_identity(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="present-token")
        )
    assert error.value.status_code == 503
    assert error.value.detail == "AUTH_NOT_CONFIGURED"
    with pytest.raises(HTTPException) as error:
        identity.verified_identity(None)
    assert error.value.status_code == 401


def test_signing_key_fetch_preserves_certificate_validation(monkeypatch):
    import ssl

    captured = {}

    def client(uri, **kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(identity, "PyJWKClient", client)
    identity.signing_keys.cache_clear()
    identity.signing_keys("https://test.supabase.co/auth/v1")
    context = captured["ssl_context"]
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname
    assert context.cert_store_stats()["x509_ca"] > 0
    identity.signing_keys.cache_clear()
