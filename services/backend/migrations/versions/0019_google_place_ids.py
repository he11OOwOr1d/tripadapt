"""Retain only an optional Google Place ID; Google details are never snapshotted."""

import sqlalchemy as sa
from alembic import op

revision = "0019_google_place_ids"
down_revision = "0018_activity_places"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "activity", sa.Column("google_place_id", sa.String(200), nullable=True)
    )
    op.create_check_constraint(
        "valid_google_place_id",
        "activity",
        "google_place_id IS NULL OR google_place_id ~ '^[A-Za-z0-9_-]{1,200}$'",
    )


def downgrade():
    op.drop_constraint("valid_google_place_id", "activity", type_="check")
    op.drop_column("activity", "google_place_id")
