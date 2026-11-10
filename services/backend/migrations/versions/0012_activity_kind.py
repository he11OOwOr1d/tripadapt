"""Persist manual meal, break and free-time blocks."""

import sqlalchemy as sa
from alembic import op

revision = "0012_activity_kind"
down_revision = "0011_create_receipts"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "activity",
        sa.Column("kind", sa.String(20), nullable=False, server_default="custom"),
    )
    op.create_check_constraint(
        "activity_kind_valid",
        "activity",
        "kind IN ('custom','meal','rest','free_time')",
    )


def downgrade():
    op.drop_constraint("activity_kind_valid", "activity", type_="check")
    op.drop_column("activity", "kind")
