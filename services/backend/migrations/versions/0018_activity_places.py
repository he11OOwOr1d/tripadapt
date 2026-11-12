"""Retain attributed OSM places and optional activity references."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0018_activity_places"
down_revision = "0017_place_references"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "discovered_place",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "destination_reference_id",
            sa.Uuid(),
            sa.ForeignKey("place_reference.id"),
            nullable=False,
        ),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
    )
    op.add_column("activity", sa.Column("place_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_activity_place", "activity", "discovered_place", ["place_id"], ["id"]
    )
    op.execute(
        "CREATE TRIGGER immutable_discovered_place BEFORE UPDATE OR DELETE ON discovered_place FOR EACH ROW EXECUTE FUNCTION protect_place_reference()"
    )
    op.execute("REVOKE ALL ON TABLE discovered_place FROM PUBLIC")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON discovered_place FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON discovered_place FROM authenticated; END IF; END $$"
    )


def downgrade():
    op.drop_constraint("fk_activity_place", "activity", type_="foreignkey")
    op.drop_column("activity", "place_id")
    op.drop_table("discovered_place")
