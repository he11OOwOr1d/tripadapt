"""Tax inclusion per cost and a standalone taxes-and-fees category."""

import sqlalchemy as sa
from alembic import op

revision = "0023_cost_item_taxes"
down_revision = "0022_cost_item_currency"
branch_labels = None
depends_on = None

OLD = "category IN ('food','activity','accommodation','transport','miscellaneous')"
NEW = (
    "category IN ('food','activity','accommodation','transport','taxes_fees',"
    "'miscellaneous')"
)


def upgrade():
    op.add_column(
        "cost_item",
        sa.Column(
            "tax_status", sa.String(10), nullable=False, server_default="unknown"
        ),
    )
    op.add_column(
        "cost_item", sa.Column("tax_percent", sa.Numeric(6, 3), nullable=True)
    )
    op.create_check_constraint(
        "cost_item_tax_status",
        "cost_item",
        "tax_status IN ('included','excluded','unknown')",
    )
    op.create_check_constraint(
        "cost_item_tax_percent",
        "cost_item",
        "tax_percent IS NULL OR (tax_status = 'excluded'"
        " AND tax_percent >= 0 AND tax_percent <= 100)",
    )
    op.drop_constraint("cost_item_category_valid", "cost_item", type_="check")
    op.create_check_constraint("cost_item_category_valid", "cost_item", NEW)


def downgrade():
    # Keep standalone tax entries as "other" rather than deleting them.
    op.execute(
        "UPDATE cost_item SET category = 'miscellaneous' WHERE category = 'taxes_fees'"
    )
    op.drop_constraint("cost_item_category_valid", "cost_item", type_="check")
    op.create_check_constraint("cost_item_category_valid", "cost_item", OLD)
    op.drop_constraint("cost_item_tax_percent", "cost_item", type_="check")
    op.drop_constraint("cost_item_tax_status", "cost_item", type_="check")
    op.drop_column("cost_item", "tax_percent")
    op.drop_column("cost_item", "tax_status")
