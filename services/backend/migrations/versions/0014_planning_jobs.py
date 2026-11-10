"""Durable fixture planning jobs."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0014_planning_jobs"
down_revision = "0013_plan_proposals"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "planning_job",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trip_id", sa.Uuid(), sa.ForeignKey("trip.id"), nullable=False),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("app_user.id"), nullable=False),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("input", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("stage", sa.String(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("lease_token", sa.Uuid()),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True)),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("proposal_id", sa.Uuid(), sa.ForeignKey("plan_proposal.id")),
        sa.Column("error_code", sa.String(60)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("trip_id", "idempotency_key"),
        sa.CheckConstraint(
            "status IN ('queued','running','succeeded','failed','cancelled','superseded')"
        ),
        sa.CheckConstraint("attempts >= 0 AND attempts <= 3"),
    )
    op.create_index("ix_planning_job_claim", "planning_job", ["status", "available_at"])
    op.execute("REVOKE ALL ON TABLE planning_job FROM PUBLIC")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON planning_job FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON planning_job FROM authenticated; END IF; END $$"
    )


def downgrade():
    op.drop_table("planning_job")
