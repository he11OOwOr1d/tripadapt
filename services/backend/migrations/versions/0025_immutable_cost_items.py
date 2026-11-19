"""Protect cost rows in accepted plan snapshots."""

from alembic import op

revision = "0025_immutable_cost_items"
down_revision = "0024_activity_skipped"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TRIGGER immutable_cost_item "
        "BEFORE INSERT OR UPDATE OR DELETE ON cost_item "
        "FOR EACH ROW EXECUTE FUNCTION guard_plan_snapshot()"
    )


def downgrade():
    op.execute("DROP TRIGGER immutable_cost_item ON cost_item")
