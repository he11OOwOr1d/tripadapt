"""Per-cost original currency with a traveler-entered conversion rate."""

import sqlalchemy as sa
from alembic import op

revision = "0022_cost_item_currency"
down_revision = "0021_cost_item_legs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("cost_item", sa.Column("currency", sa.String(3), nullable=True))
    op.add_column(
        "cost_item", sa.Column("conversion_rate", sa.Numeric(20, 10), nullable=True)
    )
    op.add_column("cost_item", sa.Column("rate_note", sa.String(200), nullable=True))
    op.add_column("cost_item", sa.Column("rate_date", sa.Date(), nullable=True))
    op.create_check_constraint(
        "cost_item_rate", "cost_item", "conversion_rate IS NULL OR conversion_rate > 0"
    )
    op.create_check_constraint(
        "cost_item_rate_needs_currency",
        "cost_item",
        "currency IS NOT NULL OR (conversion_rate IS NULL AND rate_note IS NULL"
        " AND rate_date IS NULL)",
    )


def downgrade():
    op.drop_constraint("cost_item_rate_needs_currency", "cost_item", type_="check")
    op.drop_constraint("cost_item_rate", "cost_item", type_="check")
    for column in ("rate_date", "rate_note", "conversion_rate", "currency"):
        op.drop_column("cost_item", column)
