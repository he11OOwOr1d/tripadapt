"""Remove the unused Google Place ID from activities.

Google Places was removed on 19 November 2026, the API stopped accepting or
returning the field in the previous release, and the hosted database held no
values. The downgrade restores an empty nullable column and its format check.
"""

import sqlalchemy as sa
from alembic import op

revision = "0026_drop_google_place_id"
down_revision = "0025_immutable_cost_items"
branch_labels = None
depends_on = None

CHECK = "google_place_id IS NULL OR google_place_id ~ '^[A-Za-z0-9_-]{1,200}$'"


def upgrade():
    op.drop_constraint("valid_google_place_id", "activity", type_="check")
    op.drop_column("activity", "google_place_id")


def downgrade():
    op.add_column(
        "activity", sa.Column("google_place_id", sa.String(200), nullable=True)
    )
    op.create_check_constraint("valid_google_place_id", "activity", CHECK)
