"""Private persistent trip conversation turns, processed by durable jobs."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0016_trip_conversation"
down_revision = "0015_ai_job_results"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "conversation_turn",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trip_id", sa.Uuid(), sa.ForeignKey("trip.id"), nullable=False),
        sa.Column(
            "job_id",
            sa.Uuid(),
            sa.ForeignKey("planning_job.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("user_text", sa.String(2000), nullable=False),
        sa.Column("assistant_text", sa.String(3000)),
        sa.Column("kind", sa.String(20)),
        sa.Column("choices", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_conversation_trip_created",
        "conversation_turn",
        ["trip_id", "created_at", "id"],
    )
    op.execute("REVOKE ALL ON TABLE conversation_turn FROM PUBLIC")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON conversation_turn FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON conversation_turn FROM authenticated; END IF; END $$"
    )


def downgrade():
    op.drop_table("conversation_turn")
