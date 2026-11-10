"""Store bounded AI proposal reasons separately from immutable job input."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0015_ai_job_results"
down_revision = "0014_planning_jobs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "planning_job",
        sa.Column(
            "result_metadata",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade():
    op.drop_column("planning_job", "result_metadata")
