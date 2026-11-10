"""Only provider adapters may produce TrustedIdentity; HTTP input is never trusted."""

import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from uuid import UUID

import certifi
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.persistence.database import engine
from app.persistence.models import AppUser


@dataclass(frozen=True)
class TrustedIdentity:
    issuer: str
    subject: str
    email: str
    email_normalized: str
    email_verified: bool = False
    display_name: str | None = None


bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=4)
def signing_keys(issuer: str):
    return PyJWKClient(
        f"{issuer}/.well-known/jwks.json",
        timeout=5,
        lifespan=300,
        ssl_context=ssl.create_default_context(cafile=certifi.where()),
    )


def verify_token(token: str) -> TrustedIdentity:
    issuer = settings.supabase_url.rstrip("/") + "/auth/v1"
    try:
        if jwt.get_unverified_header(token).get("alg") not in ("ES256", "RS256"):
            raise ValueError()
        key = signing_keys(issuer).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["ES256", "RS256"],
            issuer=issuer,
            audience=settings.auth_audience,
            options={"require": ["exp", "iat", "sub", "iss", "aud", "role"]},
        )
        UUID(claims["sub"])
        email = claims.get("email")
        if (
            claims["role"] != "authenticated"
            or not isinstance(email, str)
            or "@" not in email
        ):
            raise ValueError()
        if claims.get("is_anonymous", False):
            raise ValueError()
        return TrustedIdentity(issuer, claims["sub"], email, email.casefold())
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(503, "AUTH_PROVIDER_UNAVAILABLE") from None
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "AUTH_REQUIRED") from None


def verified_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> TrustedIdentity:
    if not credentials:
        raise HTTPException(401, "AUTH_REQUIRED")
    if not settings.supabase_url:
        raise HTTPException(503, "AUTH_NOT_CONFIGURED")
    return verify_token(credentials.credentials)


def session():
    with Session(engine) as db:
        with db.begin():
            yield db


def current_user(
    identity: TrustedIdentity = Depends(verified_identity),
    db: Session = Depends(session),
) -> AppUser:
    user = db.scalar(
        select(AppUser).where(
            AppUser.auth_issuer == identity.issuer,
            AppUser.auth_subject == identity.subject,
        )
    )
    if user is None:
        db.execute(
            insert(AppUser)
            .values(
                auth_issuer=identity.issuer,
                auth_subject=identity.subject,
                email=identity.email,
                email_normalized=identity.email_normalized,
                email_verified_at=datetime.now(timezone.utc)
                if identity.email_verified
                else None,
                display_name=identity.display_name,
            )
            .on_conflict_do_nothing(index_elements=["auth_issuer", "auth_subject"])
        )
        user = db.scalar(
            select(AppUser).where(
                AppUser.auth_issuer == identity.issuer,
                AppUser.auth_subject == identity.subject,
            )
        )
    return user
