"""Frozen manual proposals and acceptance preconditions."""

import sqlalchemy as sa
from alembic import op

revision = "0013_plan_proposals"
down_revision = "0012_activity_kind"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "plan_proposal",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trip_id", sa.Uuid(), sa.ForeignKey("trip.id"), nullable=False),
        sa.Column("candidate_version_id", sa.Uuid(), nullable=False),
        sa.Column("base_draft_id", sa.Uuid(), nullable=False),
        sa.Column("base_edit_sequence", sa.BigInteger(), nullable=False),
        sa.Column("base_current_id", sa.Uuid()),
        sa.Column("submit_key", sa.Uuid(), nullable=False),
        sa.Column("accept_key", sa.Uuid()),
        sa.Column("accept_fingerprint", sa.String(64)),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("trip_id", "submit_key"),
        sa.CheckConstraint("status IN ('pending','accepted','discarded')"),
        *[
            sa.ForeignKeyConstraint(
                ["trip_id", name], ["plan_version.trip_id", "plan_version.id"]
            )
            for name in ("candidate_version_id", "base_draft_id", "base_current_id")
        ],
    )
    # App data is accessible only through the authorized backend.
    op.execute("REVOKE ALL ON TABLE plan_proposal FROM PUBLIC")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE plan_proposal FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE plan_proposal FROM authenticated; END IF; END $$"
    )


def downgrade():
    op.drop_table("plan_proposal")
