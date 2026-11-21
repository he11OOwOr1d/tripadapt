"""Let one transaction erase one whole trip, without weakening the protection of accepted plans.

Accepted plan versions, and the stops, activities and costs under them, may never be changed or deleted
(`guard_plan_snapshot`). Permanently erasing a trip that was deleted more than the recovery window ago has to delete
them, so the guard gains one narrow exception: a DELETE is allowed when the transaction has declared that it is
erasing that exact trip, with `SET LOCAL app.erasing_trip = '<trip id>'` (transaction-local: it ends with the
transaction). An UPDATE of an accepted row, a DELETE for any other trip, and anything without the declaration are
refused exactly as before.
"""

from alembic import op

revision = "0027_allow_trip_erasure"
down_revision = "0026_drop_google_place_id"
branch_labels = None
depends_on = None

ORIGINAL = """
CREATE OR REPLACE FUNCTION guard_plan_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text;
BEGIN
  IF TG_TABLE_NAME = 'plan_version' THEN
    IF OLD.status = 'accepted' THEN RAISE EXCEPTION 'Accepted version is immutable'; END IF;
  ELSE
    SELECT status INTO state FROM plan_version WHERE id = COALESCE(NEW.version_id, OLD.version_id) FOR UPDATE;
    IF state = 'accepted' THEN RAISE EXCEPTION 'Accepted snapshot is immutable'; END IF;
    IF TG_OP = 'UPDATE' AND NEW.version_id != OLD.version_id THEN
      RAISE EXCEPTION 'Cannot reparent snapshot rows';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
"""

WITH_ERASURE = """
CREATE OR REPLACE FUNCTION guard_plan_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text; owner uuid;
BEGIN
  IF TG_TABLE_NAME = 'plan_version' THEN
    IF OLD.status = 'accepted' AND NOT (
      TG_OP = 'DELETE' AND COALESCE(current_setting('app.erasing_trip', true), '') = OLD.trip_id::text
    ) THEN RAISE EXCEPTION 'Accepted version is immutable'; END IF;
  ELSE
    SELECT status, trip_id INTO state, owner FROM plan_version WHERE id = COALESCE(NEW.version_id, OLD.version_id) FOR UPDATE;
    IF state = 'accepted' AND NOT (
      TG_OP = 'DELETE' AND COALESCE(current_setting('app.erasing_trip', true), '') = owner::text
    ) THEN RAISE EXCEPTION 'Accepted snapshot is immutable'; END IF;
    IF TG_OP = 'UPDATE' AND NEW.version_id != OLD.version_id THEN
      RAISE EXCEPTION 'Cannot reparent snapshot rows';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
"""


def upgrade():
    op.execute(WITH_ERASURE)


def downgrade():
    op.execute(ORIGINAL)
