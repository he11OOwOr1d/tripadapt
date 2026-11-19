"""Traveler-recorded "didn't happen" outcome, exclusive with completed."""

import sqlalchemy as sa
from alembic import op

revision = "0024_activity_skipped"
down_revision = "0023_cost_item_taxes"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "activity",
        sa.Column("skipped", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_check_constraint(
        "activity_one_outcome", "activity", "NOT (completed AND skipped)"
    )


def downgrade():
    op.drop_constraint("activity_one_outcome", "activity", type_="check")
    op.drop_column("activity", "skipped")
