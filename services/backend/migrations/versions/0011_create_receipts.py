"""Owner-scoped idempotent initial trip creation."""

import sqlalchemy as sa
from alembic import op

revision = "0011_create_receipts"
down_revision = "0010_user_activities"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "trip_create_receipt",
        sa.Column(
            "owner_id", sa.Uuid(), sa.ForeignKey("app_user.id"), primary_key=True
        ),
        sa.Column("key", sa.Uuid(), primary_key=True),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("trip_id", sa.Uuid(), sa.ForeignKey("trip.id"), nullable=False),
    )
    op.execute("REVOKE ALL ON trip_create_receipt FROM PUBLIC")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON trip_create_receipt FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON trip_create_receipt FROM authenticated; END IF; END $$"
    )


def downgrade():
    op.drop_table("trip_create_receipt")
