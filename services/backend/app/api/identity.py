"""Only provider adapters may produce TrustedIdentity; HTTP input is never trusted."""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

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


def verified_identity() -> TrustedIdentity:
    # Intentionally disabled until a provider verifies signature, issuer,
    # audience, expiry and required claims. No development header bypass.
    raise HTTPException(401, "AUTH_REQUIRED")


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
