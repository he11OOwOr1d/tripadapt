from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.database import Base


class SystemProbe(Base):
    """Infrastructure marker; deliberately separate from private trip records."""

    __tablename__ = "system_probe"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    initialized_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


Json = JSON().with_variant(JSONB, "postgresql")


class AppUser(Base):
    __tablename__ = "app_user"
    __table_args__ = (
        UniqueConstraint("auth_issuer", "auth_subject"),
        Index(
            "uq_verified_email",
            "email_normalized",
            unique=True,
            postgresql_where=text("email_verified_at IS NOT NULL"),
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    auth_issuer: Mapped[str]
    auth_subject: Mapped[str]
    email: Mapped[str]
    email_normalized: Mapped[str]
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    display_name: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Trip(Base):
    __tablename__ = "trip"
    __table_args__ = (
        ForeignKeyConstraint(
            ["id", "current_version_id"],
            ["plan_version.trip_id", "plan_version.id"],
            name="fk_trip_current",
            use_alter=True,
        ),
        ForeignKeyConstraint(
            ["id", "draft_version_id"],
            ["plan_version.trip_id", "plan_version.id"],
            name="fk_trip_draft",
            use_alter=True,
        ),
        CheckConstraint("lifecycle IN ('planning','active','completed','archived')"),
        CheckConstraint("lock_version >= 0"),
        Index(
            "ix_trip_owner_updated",
            "owner_id",
            "updated_at",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("app_user.id"))
    title: Mapped[str] = mapped_column(String(300))
    lifecycle: Mapped[str] = mapped_column(default="planning")
    current_version_id: Mapped[UUID | None] = mapped_column(Uuid)
    draft_version_id: Mapped[UUID | None] = mapped_column(Uuid)
    lock_version: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PlanVersion(Base):
    __tablename__ = "plan_version"
    __table_args__ = (
        UniqueConstraint("trip_id", "id"),
        UniqueConstraint("trip_id", "version_number"),
        ForeignKeyConstraint(
            ["trip_id", "parent_version_id"],
            ["plan_version.trip_id", "plan_version.id"],
        ),
        CheckConstraint(
            "status IN ('draft','proposed','accepted','rejected','superseded')"
        ),
        CheckConstraint("source IN ('user','agent','restore')"),
        CheckConstraint("date_mode IN ('exact','window','duration','open_ended')"),
        CheckConstraint(
            "validation_status IN ('unchecked','feasible','provisional','conflicted')"
        ),
        CheckConstraint("budget_mode IN ('target','strict')"),
        CheckConstraint("traveler_count > 0 AND room_count > 0"),
        CheckConstraint("desired_days IS NULL OR desired_days > 0"),
        CheckConstraint("budget_amount IS NULL OR budget_amount >= 0"),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date"
        ),
        CheckConstraint(
            "window_end IS NULL OR window_start IS NULL OR window_end >= window_start"
        ),
        CheckConstraint("date_mode != 'exact' OR start_date IS NOT NULL"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(ForeignKey("trip.id"))
    parent_version_id: Mapped[UUID | None] = mapped_column(Uuid)
    version_number: Mapped[int] = mapped_column(BigInteger)
    edit_sequence: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(default="draft")
    source: Mapped[str] = mapped_column(default="user")
    date_mode: Mapped[str]
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    window_start: Mapped[date | None] = mapped_column(Date)
    window_end: Mapped[date | None] = mapped_column(Date)
    desired_days: Mapped[int | None]
    traveler_count: Mapped[int]
    room_count: Mapped[int]
    display_currency: Mapped[str] = mapped_column(String(3))
    budget_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    budget_mode: Mapped[str] = mapped_column(default="target")
    preferences: Mapped[dict] = mapped_column(Json, default=dict)
    origin: Mapped[dict | None] = mapped_column(Json)
    return_location: Mapped[dict | None] = mapped_column(Json)
    validation_status: Mapped[str] = mapped_column(default="unchecked")
    validation_report: Mapped[dict] = mapped_column(Json, default=dict)
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("app_user.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DestinationStop(Base):
    __tablename__ = "destination_stop"
    __table_args__ = (
        UniqueConstraint("version_id", "id"),
        UniqueConstraint("version_id", "logical_item_id"),
        UniqueConstraint("version_id", "position"),
        CheckConstraint("position >= 0"),
        CheckConstraint("suggested_nights IS NULL OR suggested_nights >= 0"),
        CheckConstraint(
            "departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date"
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    version_id: Mapped[UUID] = mapped_column(
        ForeignKey("plan_version.id", ondelete="CASCADE")
    )
    logical_item_id: Mapped[UUID] = mapped_column(Uuid, default=uuid4)
    position: Mapped[int]
    name: Mapped[str] = mapped_column(String(300))
    timezone: Mapped[str]
    suggested_nights: Mapped[int | None]
    arrival_date: Mapped[date | None] = mapped_column(Date)
    departure_date: Mapped[date | None] = mapped_column(Date)


class Activity(Base):
    """Relative, user-entered schedule; never a provider reservation."""

    __tablename__ = "activity"
    __table_args__ = (
        UniqueConstraint("version_id", "logical_item_id"),
        ForeignKeyConstraint(
            ["version_id", "stop_id"],
            ["destination_stop.version_id", "destination_stop.id"],
        ),
        CheckConstraint("local_day_offset >= 0 AND duration_minutes > 0"),
        CheckConstraint(
            "kind IN ('custom','meal','rest','free_time')", name="activity_kind_valid"
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    version_id: Mapped[UUID] = mapped_column(
        ForeignKey("plan_version.id", ondelete="CASCADE")
    )
    logical_item_id: Mapped[UUID] = mapped_column(Uuid)
    stop_id: Mapped[UUID] = mapped_column(Uuid)
    kind: Mapped[str] = mapped_column(
        String(20), default="custom", server_default="custom"
    )
    user_label: Mapped[str] = mapped_column(String(300))
    local_day_offset: Mapped[int]
    local_start_time: Mapped[str] = mapped_column(String(8))
    duration_minutes: Mapped[int]
    fixed: Mapped[bool]
    completed: Mapped[bool]
    booked: Mapped[bool]


class CreateReceipt(Base):
    """Owner-scoped replay protection for initial account saves."""

    __tablename__ = "trip_create_receipt"
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("app_user.id"), primary_key=True)
    key: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    trip_id: Mapped[UUID] = mapped_column(ForeignKey("trip.id"))


class PlanProposal(Base):
    """A frozen candidate tied to the exact draft and accepted base reviewed."""

    __tablename__ = "plan_proposal"
    __table_args__ = (
        UniqueConstraint("trip_id", "submit_key"),
        ForeignKeyConstraint(
            ["trip_id", "candidate_version_id"],
            ["plan_version.trip_id", "plan_version.id"],
        ),
        ForeignKeyConstraint(
            ["trip_id", "base_draft_id"], ["plan_version.trip_id", "plan_version.id"]
        ),
        ForeignKeyConstraint(
            ["trip_id", "base_current_id"], ["plan_version.trip_id", "plan_version.id"]
        ),
        CheckConstraint("status IN ('pending','accepted','discarded')"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(ForeignKey("trip.id"))
    candidate_version_id: Mapped[UUID] = mapped_column(Uuid)
    base_draft_id: Mapped[UUID] = mapped_column(Uuid)
    base_edit_sequence: Mapped[int] = mapped_column(BigInteger)
    base_current_id: Mapped[UUID | None] = mapped_column(Uuid)
    submit_key: Mapped[UUID] = mapped_column(Uuid)
    accept_key: Mapped[UUID | None] = mapped_column(Uuid)
    accept_fingerprint: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PlanningJob(Base):
    """Durable, leased work; input snapshots never change after admission."""

    __tablename__ = "planning_job"
    __table_args__ = (
        UniqueConstraint("trip_id", "idempotency_key"),
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed','cancelled','superseded')"
        ),
        CheckConstraint("attempts >= 0 AND attempts <= 3"),
        Index("ix_planning_job_claim", "status", "available_at"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(ForeignKey("trip.id"))
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("app_user.id"))
    idempotency_key: Mapped[UUID] = mapped_column(Uuid)
    fingerprint: Mapped[str] = mapped_column(String(64))
    input: Mapped[dict] = mapped_column(Json)
    result_metadata: Mapped[dict] = mapped_column(Json, default=dict)
    status: Mapped[str] = mapped_column(default="queued")
    stage: Mapped[str] = mapped_column(default="Waiting for a worker")
    attempts: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    lease_token: Mapped[UUID | None] = mapped_column(Uuid)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_requested: Mapped[bool] = mapped_column(default=False)
    proposal_id: Mapped[UUID | None] = mapped_column(ForeignKey("plan_proposal.id"))
    error_code: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ConversationTurn(Base):
    __tablename__ = "conversation_turn"
    __table_args__ = (
        UniqueConstraint("job_id"),
        Index("ix_conversation_trip_created", "trip_id", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(ForeignKey("trip.id"))
    job_id: Mapped[UUID] = mapped_column(ForeignKey("planning_job.id"))
    user_text: Mapped[str] = mapped_column(String(2000))
    assistant_text: Mapped[str | None] = mapped_column(String(3000))
    kind: Mapped[str | None] = mapped_column(String(20))
    choices: Mapped[list] = mapped_column(Json, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
