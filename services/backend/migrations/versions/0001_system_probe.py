"""Initialize infrastructure connectivity marker."""

import sqlalchemy as sa
from alembic import op

revision = "0001_system_probe"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "system_probe",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "initialized_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.execute("INSERT INTO system_probe (id) VALUES (1)")


def downgrade():
    op.drop_table("system_probe")
