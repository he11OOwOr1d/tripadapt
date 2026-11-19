"""Allow a cost to link to one intercity journey by its stable leg key."""

import sqlalchemy as sa
from alembic import op

revision = "0021_cost_item_legs"
down_revision = "0020_cost_items"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("cost_item", sa.Column("leg_key", sa.String(1500), nullable=True))
    op.drop_constraint("cost_item_single_link", "cost_item", type_="check")
    op.create_check_constraint(
        "cost_item_single_link",
        "cost_item",
        "num_nonnulls(activity_logical_id, stop_logical_id, leg_key) <= 1",
    )
    op.drop_constraint("cost_item_removed_link", "cost_item", type_="check")
    op.create_check_constraint(
        "cost_item_removed_link",
        "cost_item",
        "NOT link_removed OR (amount_status = 'paid'"
        " AND num_nonnulls(activity_logical_id, stop_logical_id, leg_key) = 0)",
    )


def downgrade():
    # Journey links cannot be represented before this revision; keep payments
    # by flagging them as removed links rather than deleting them.
    op.execute(
        "UPDATE cost_item SET link_removed = true, leg_key = NULL"
        " WHERE leg_key IS NOT NULL AND amount_status = 'paid'"
    )
    op.execute("DELETE FROM cost_item WHERE leg_key IS NOT NULL")
    op.drop_constraint("cost_item_removed_link", "cost_item", type_="check")
    op.create_check_constraint(
        "cost_item_removed_link",
        "cost_item",
        "NOT link_removed OR (amount_status = 'paid' AND activity_logical_id IS NULL"
        " AND stop_logical_id IS NULL)",
    )
    op.drop_constraint("cost_item_single_link", "cost_item", type_="check")
    op.create_check_constraint(
        "cost_item_single_link",
        "cost_item",
        "activity_logical_id IS NULL OR stop_logical_id IS NULL",
    )
    op.drop_column("cost_item", "leg_key")
