"""Version-owned traveler cost items; moves preference cost records into rows."""

import json

import sqlalchemy as sa
from alembic import op

revision = "0020_cost_items"
down_revision = "0019_google_place_ids"
branch_labels = None
depends_on = None


def upgrade():
    # Freeze plan writes before reading legacy costs. This also acquires the
    # lock needed to toggle the snapshot trigger without a later lock upgrade.
    op.execute("LOCK TABLE plan_version IN SHARE ROW EXCLUSIVE MODE")
    op.create_table(
        "cost_item",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "version_id",
            sa.Uuid(),
            sa.ForeignKey("plan_version.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("logical_item_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("amount_status", sa.String(20), nullable=False),
        sa.Column("activity_logical_id", sa.Uuid(), nullable=True),
        sa.Column("stop_logical_id", sa.Uuid(), nullable=True),
        sa.Column(
            "link_removed", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.UniqueConstraint("version_id", "logical_item_id"),
        sa.UniqueConstraint("version_id", "position"),
        sa.CheckConstraint(
            "category IN ('food','activity','accommodation','transport','miscellaneous')",
            name="cost_item_category_valid",
        ),
        sa.CheckConstraint(
            "unit IN ('per_person','per_group')", name="cost_item_unit_valid"
        ),
        sa.CheckConstraint(
            "amount_status IN ('estimated','paid')", name="cost_item_status_valid"
        ),
        sa.CheckConstraint("quantity BETWEEN 1 AND 10000", name="cost_item_quantity"),
        sa.CheckConstraint("amount IS NULL OR amount >= 0", name="cost_item_amount"),
        sa.CheckConstraint(
            "amount_status <> 'paid' OR amount IS NOT NULL",
            name="cost_item_paid_amount",
        ),
        sa.CheckConstraint(
            "activity_logical_id IS NULL OR stop_logical_id IS NULL",
            name="cost_item_single_link",
        ),
        sa.CheckConstraint(
            "NOT link_removed OR (amount_status = 'paid' AND activity_logical_id IS NULL"
            " AND stop_logical_id IS NULL)",
            name="cost_item_removed_link",
        ),
        sa.CheckConstraint("position >= 0", name="cost_item_position"),
    )
    op.create_index("ix_cost_item_version", "cost_item", ["version_id"])
    # Move the short-lived JSON records (one unreleased slice) into rows.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, preferences FROM plan_version "
            "WHERE preferences::jsonb ? 'cost_records'"
        )
    ).fetchall()
    # Accepted snapshots may contain legacy records too. Move their cost
    # representation inside this migration transaction, then restore the guard.
    if rows:
        op.execute("ALTER TABLE plan_version DISABLE TRIGGER immutable_plan")
    for version_id, preferences in rows:
        prefs = (
            preferences if isinstance(preferences, dict) else json.loads(preferences)
        )
        for position, record in enumerate(prefs.pop("cost_records", []) or []):
            conn.execute(
                sa.text(
                    "INSERT INTO cost_item (id, version_id, logical_item_id, position,"
                    " category, label, unit, quantity, amount, amount_status)"
                    " VALUES (gen_random_uuid(), :v, :l, :p, :c, :label, :u, :q, :a, :s)"
                ),
                dict(
                    v=version_id,
                    l=record["id"],
                    p=position,
                    c=record["category"],
                    label=record["label"],
                    u=record["unit"],
                    q=record["quantity"],
                    a=None if record["amount"] == "" else record["amount"],
                    s=record["status"],
                ),
            )
        conn.execute(
            sa.text(
                "UPDATE plan_version SET preferences = CAST(:p AS jsonb) WHERE id = :v"
            ),
            dict(p=json.dumps(prefs), v=version_id),
        )

    if rows:
        op.execute("ALTER TABLE plan_version ENABLE TRIGGER immutable_plan")


def downgrade():
    op.drop_index("ix_cost_item_version", table_name="cost_item")
    op.drop_table("cost_item")
