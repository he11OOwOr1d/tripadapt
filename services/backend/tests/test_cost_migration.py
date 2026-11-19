import json
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.persistence.database import engine


def test_legacy_costs_on_accepted_plan_survive_upgrade():
    schema = f"qa_cost_{uuid4().hex}"
    owner_id, trip_id, version_id, cost_id, estimate_id = (uuid4() for _ in range(5))
    prefs = {
        "pace": "slow",
        "cost_records": [
            {
                "id": str(ident),
                "category": "food",
                "label": label,
                "unit": "per_group",
                "quantity": 1,
                "amount": amount,
                "status": status,
            }
            for ident, label, amount, status in (
                (cost_id, "Zero", 0, "paid"),
                (estimate_id, "Unknown", "", "estimated"),
            )
        ],
    }
    with engine.connect() as connection, connection.begin() as transaction:
        try:
            connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
            connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}")
            config = Config("alembic.ini")
            config.set_main_option("path_separator", "os")
            config.attributes["connection"] = connection
            command.upgrade(config, "0019_google_place_ids")
            connection.execute(
                text(
                    "INSERT INTO app_user (id, auth_issuer, auth_subject, email, email_normalized)"
                    " VALUES (:id, 'qa', 'qa', 'qa@example.org', 'qa@example.org')"
                ),
                {"id": owner_id},
            )
            connection.execute(
                text(
                    "INSERT INTO trip (id, owner_id, title, lifecycle, lock_version)"
                    " VALUES (:id, :owner, 'Migration QA', 'planning', 0)"
                ),
                {"id": trip_id, "owner": owner_id},
            )
            connection.execute(
                text(
                    "INSERT INTO plan_version (id, trip_id, version_number, edit_sequence,"
                    " status, source, date_mode, traveler_count, room_count, display_currency,"
                    " budget_mode, preferences, validation_status, validation_report, accepted_at)"
                    " VALUES (:id, :trip, 1, 0, 'accepted', 'user', 'open_ended', 1, 1, 'USD',"
                    " 'target', CAST(:prefs AS jsonb), 'provisional', '{}', now())"
                ),
                {"id": version_id, "trip": trip_id, "prefs": json.dumps(prefs)},
            )
            command.upgrade(config, "head")
            assert connection.exec_driver_sql(
                "SELECT status, preferences FROM plan_version"
            ).one() == ("accepted", {"pace": "slow"})
            assert connection.exec_driver_sql(
                "SELECT logical_item_id, amount::text, amount_status, currency, tax_status"
                " FROM cost_item ORDER BY position"
            ).all() == [
                (cost_id, "0.0000", "paid", None, "unknown"),
                (estimate_id, None, "estimated", None, "unknown"),
            ]
            with (
                pytest.raises(ProgrammingError, match="Accepted version is immutable"),
                connection.begin_nested(),
            ):
                connection.exec_driver_sql(
                    "UPDATE plan_version SET preferences = '{}'::jsonb"
                )
            for statement in (
                "UPDATE cost_item SET amount = 99",
                "DELETE FROM cost_item",
                "INSERT INTO cost_item (id, version_id, logical_item_id, position,"
                " category, label, unit, quantity, amount_status)"
                " SELECT gen_random_uuid(), id, gen_random_uuid(), 2,"
                " 'food', 'Extra', 'per_group', 1, 'estimated' FROM plan_version",
            ):
                with (
                    pytest.raises(
                        ProgrammingError, match="Accepted snapshot is immutable"
                    ),
                    connection.begin_nested(),
                ):
                    connection.exec_driver_sql(statement)
            costs_before = connection.exec_driver_sql(
                "SELECT * FROM cost_item ORDER BY position"
            ).all()
            command.downgrade(config, "0024_activity_skipped")
            assert (
                connection.exec_driver_sql(
                    "SELECT * FROM cost_item ORDER BY position"
                ).all()
                == costs_before
            )
            assert not connection.exec_driver_sql(
                "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE "
                "tgname = 'immutable_cost_item' AND tgrelid = 'cost_item'::regclass)"
            ).scalar_one()
            command.upgrade(config, "head")
            with (
                pytest.raises(ProgrammingError, match="Accepted snapshot is immutable"),
                connection.begin_nested(),
            ):
                connection.exec_driver_sql("DELETE FROM cost_item")
        finally:
            transaction.rollback()
