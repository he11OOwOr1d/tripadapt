"""Retain immutable provider geography; manual and historical stops remain valid."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0017_place_references"
down_revision = "0016_trip_conversation"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "place_reference",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("provider_place_id", sa.BigInteger(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.CheckConstraint("provider = 'open_meteo_geonames'"),
        sa.CheckConstraint("provider_place_id > 0"),
    )
    op.add_column(
        "destination_stop", sa.Column("place_reference_id", sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        "fk_stop_place_reference",
        "destination_stop",
        "place_reference",
        ["place_reference_id"],
        ["id"],
    )
    op.execute(
        """CREATE FUNCTION protect_place_reference() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Place references are immutable'; END $$"""
    )
    op.execute(
        "CREATE TRIGGER immutable_place_reference BEFORE UPDATE OR DELETE ON place_reference FOR EACH ROW EXECUTE FUNCTION protect_place_reference()"
    )
    op.execute("REVOKE ALL ON TABLE place_reference FROM PUBLIC")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON place_reference FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON place_reference FROM authenticated; END IF; END $$"
    )


def downgrade():
    op.drop_constraint(
        "fk_stop_place_reference", "destination_stop", type_="foreignkey"
    )
    op.drop_column("destination_stop", "place_reference_id")
    op.drop_table("place_reference")
    op.execute("DROP FUNCTION protect_place_reference()")
