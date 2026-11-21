from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.persistence.database import engine


def refused(connection, sql, params):
    with pytest.raises(DBAPIError, match="immutable"):
        with connection.begin_nested():
            connection.execute(text(sql), params)


def allowed(connection, sql, params):
    with connection.begin_nested():
        return connection.execute(text(sql), params).rowcount


def declare(connection, trip):
    connection.execute(text("SELECT set_config('app.erasing_trip', :t, true)"), {"t": str(trip) if trip else ""})


def test_the_guard_gains_one_narrow_exception_and_loses_it_on_downgrade():
    schema = f"qa_erase_{uuid4().hex}"
    owner = uuid4()
    mine, other = uuid4(), uuid4()
    versions = {mine: uuid4(), other: uuid4()}
    stops = {mine: uuid4(), other: uuid4()}
    with engine.connect() as connection, connection.begin() as transaction:
        try:
            connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
            connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}")
            config = Config("alembic.ini")
            config.set_main_option("path_separator", "os")
            config.attributes["connection"] = connection
            command.upgrade(config, "0026_drop_google_place_id")
            connection.execute(
                text(
                    "INSERT INTO app_user (id, auth_issuer, auth_subject, email, email_normalized)"
                    " VALUES (:id, 'qa', 'qa', 'qa@example.org', 'qa@example.org')"
                ),
                {"id": owner},
            )
            for trip in (mine, other):
                connection.execute(
                    text("INSERT INTO trip (id, owner_id, title, lifecycle, lock_version) VALUES (:id, :o, 'QA', 'planning', 0)"),
                    {"id": trip, "o": owner},
                )
                connection.execute(
                    text(
                        "INSERT INTO plan_version (id, trip_id, version_number, edit_sequence, status, source, date_mode,"
                        " traveler_count, room_count, display_currency, budget_mode, preferences, validation_status,"
                        " validation_report) VALUES (:id, :trip, 1, 0, 'accepted', 'user', 'open_ended', 1, 1, 'USD',"
                        " 'target', '{}'::jsonb, 'provisional', '{}')"
                    ),
                    {"id": versions[trip], "trip": trip},
                )
            # A stop cannot be added to an accepted version, so give the other trip a second version: a draft that gets
            # a stop and is then accepted.
            draft, draft_trip = uuid4(), other
            connection.execute(
                text(
                    "INSERT INTO plan_version (id, trip_id, version_number, edit_sequence, status, source, date_mode,"
                    " traveler_count, room_count, display_currency, budget_mode, preferences, validation_status,"
                    " validation_report) VALUES (:id, :trip, 2, 0, 'draft', 'user', 'open_ended', 1, 1, 'USD',"
                    " 'target', '{}'::jsonb, 'provisional', '{}')"
                ),
                {"id": draft, "trip": draft_trip},
            )
            connection.execute(
                text(
                    "INSERT INTO destination_stop (id, version_id, logical_item_id, position, name, timezone)"
                    " VALUES (:id, :v, :l, 0, 'Jaipur', 'Asia/Kolkata')"
                ),
                {"id": stops[other], "v": draft, "l": uuid4()},
            )
            connection.execute(text("UPDATE plan_version SET status = 'accepted' WHERE id = :v"), {"v": draft})
            kill = "DELETE FROM plan_version WHERE id = :v"

            # Before this migration: nothing opens the guard, not even a declaration.
            declare(connection, mine)
            refused(connection, kill, {"v": versions[mine]})
            declare(connection, None)

            command.upgrade(config, "0027_allow_trip_erasure")
            connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}")
            # After it: no declaration, a declaration for another trip, and an UPDATE are all still refused.
            refused(connection, kill, {"v": versions[mine]})
            declare(connection, other)
            refused(connection, kill, {"v": versions[mine]})
            declare(connection, mine)
            refused(connection, "UPDATE plan_version SET traveler_count = 5 WHERE id = :v", {"v": versions[mine]})
            # Under a snapshot row of an accepted version, the same rules hold.
            refused(connection, "DELETE FROM destination_stop WHERE id = :s", {"s": stops[other]})
            # The declared trip, and only it, may be deleted.
            assert allowed(connection, kill, {"v": versions[mine]}) == 1
            refused(connection, kill, {"v": versions[other]})
            declare(connection, other)
            assert allowed(connection, "DELETE FROM plan_version WHERE trip_id = :t", {"t": other}) == 2
            declare(connection, None)

            # Downgrading puts the original strictness back.
            connection.execute(
                text("INSERT INTO plan_version (id, trip_id, version_number, edit_sequence, status, source, date_mode,"
                     " traveler_count, room_count, display_currency, budget_mode, preferences, validation_status,"
                     " validation_report) VALUES (:id, :trip, 9, 0, 'accepted', 'user', 'open_ended', 1, 1, 'USD',"
                     " 'target', '{}'::jsonb, 'provisional', '{}')"),
                {"id": (again := uuid4()), "trip": mine},
            )
            command.downgrade(config, "0026_drop_google_place_id")
            connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}")
            declare(connection, mine)
            refused(connection, kill, {"v": again})
        finally:
            transaction.rollback()
