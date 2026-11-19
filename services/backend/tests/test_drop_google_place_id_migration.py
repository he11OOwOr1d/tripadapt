from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.persistence.database import engine

COLUMN = (
    "SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema()"
    " AND table_name = 'activity' AND column_name = 'google_place_id'"
)
CHECK = (
    "SELECT count(*) FROM pg_constraint WHERE conname = 'valid_google_place_id'"
    " AND conrelid = 'activity'::regclass"
)


def test_dropping_the_unused_google_id_keeps_activities_and_is_reversible():
    schema = f"qa_google_{uuid4().hex}"
    owner, trip, version, stop, item = (uuid4() for _ in range(5))
    with engine.connect() as connection, connection.begin() as transaction:
        try:
            connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
            connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}")
            config = Config("alembic.ini")
            config.set_main_option("path_separator", "os")
            config.attributes["connection"] = connection
            command.upgrade(config, "0025_immutable_cost_items")
            assert connection.exec_driver_sql(COLUMN).scalar_one() == 1
            assert connection.exec_driver_sql(CHECK).scalar_one() == 1
            connection.execute(
                text(
                    "INSERT INTO app_user (id, auth_issuer, auth_subject, email, email_normalized)"
                    " VALUES (:id, 'qa', 'qa', 'qa@example.org', 'qa@example.org')"
                ),
                {"id": owner},
            )
            connection.execute(
                text(
                    "INSERT INTO trip (id, owner_id, title, lifecycle, lock_version)"
                    " VALUES (:id, :owner, 'Drop QA', 'planning', 0)"
                ),
                {"id": trip, "owner": owner},
            )
            connection.execute(
                text(
                    "INSERT INTO plan_version (id, trip_id, version_number, edit_sequence,"
                    " status, source, date_mode, traveler_count, room_count, display_currency,"
                    " budget_mode, preferences, validation_status, validation_report)"
                    " VALUES (:id, :trip, 1, 0, 'draft', 'user', 'open_ended', 1, 1, 'USD',"
                    " 'target', '{}'::jsonb, 'provisional', '{}')"
                ),
                {"id": version, "trip": trip},
            )
            connection.execute(
                text(
                    "INSERT INTO destination_stop (id, version_id, logical_item_id, position,"
                    " name, timezone) VALUES (:id, :version, gen_random_uuid(), 0, 'Stop', 'UTC')"
                ),
                {"id": stop, "version": version},
            )
            connection.execute(
                text(
                    "INSERT INTO activity (id, version_id, logical_item_id, stop_id, user_label,"
                    " local_day_offset, local_start_time, duration_minutes, fixed, completed,"
                    " booked, google_place_id) VALUES (gen_random_uuid(), :version, :item, :stop,"
                    " 'Legacy visit', 2, '10:30:00', 45, true, false, true, 'ChIJ_legacy')"
                ),
                {"version": version, "item": item, "stop": stop},
            )
            before = (
                "SELECT logical_item_id, user_label, local_day_offset, local_start_time::text,"
                " duration_minutes, fixed, completed, booked, skipped, kind, place_id"
                " FROM activity"
            )
            expected = connection.exec_driver_sql(before).all()
            assert len(expected) == 1 and expected[0][0] == item

            command.upgrade(config, "head")
            assert connection.exec_driver_sql(COLUMN).scalar_one() == 0
            assert connection.exec_driver_sql(CHECK).scalar_one() == 0
            assert connection.exec_driver_sql(before).all() == expected

            command.downgrade(config, "0025_immutable_cost_items")
            assert connection.exec_driver_sql(COLUMN).scalar_one() == 1
            assert connection.exec_driver_sql(CHECK).scalar_one() == 1
            assert connection.exec_driver_sql(before).all() == expected
            assert (
                connection.exec_driver_sql(
                    "SELECT google_place_id FROM activity"
                ).scalar_one()
                is None
            )
            with pytest.raises(IntegrityError), connection.begin_nested():
                connection.exec_driver_sql(
                    "UPDATE activity SET google_place_id = 'not valid!'"
                )

            command.upgrade(config, "head")
            assert connection.exec_driver_sql(COLUMN).scalar_one() == 0
            assert connection.exec_driver_sql(before).all() == expected
        finally:
            transaction.rollback()
