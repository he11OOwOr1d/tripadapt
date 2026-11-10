"""User-entered relative draft activities, protected with snapshot guards."""

import sqlalchemy as sa
from alembic import op

revision = "0010_user_activities"
down_revision = "4b1db6085c26"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "activity",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "version_id",
            sa.Uuid(),
            sa.ForeignKey("plan_version.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("logical_item_id", sa.Uuid(), nullable=False),
        sa.Column("stop_id", sa.Uuid(), nullable=False),
        sa.Column("user_label", sa.String(300), nullable=False),
        sa.Column("local_day_offset", sa.Integer(), nullable=False),
        sa.Column("local_start_time", sa.String(8), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("fixed", sa.Boolean(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("booked", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("version_id", "logical_item_id"),
        sa.ForeignKeyConstraint(
            ["version_id", "stop_id"],
            ["destination_stop.version_id", "destination_stop.id"],
        ),
        sa.CheckConstraint("local_day_offset >= 0 AND duration_minutes > 0"),
    )
    op.execute(
        "CREATE TRIGGER immutable_activity BEFORE INSERT OR UPDATE OR DELETE ON activity FOR EACH ROW EXECUTE FUNCTION guard_plan_snapshot()"
    )
    op.execute("REVOKE ALL ON activity FROM PUBLIC")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON activity FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON activity FROM authenticated; END IF; END $$"
    )


def downgrade():
    op.drop_table("activity")
