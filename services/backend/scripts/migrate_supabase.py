"""Apply app migrations and remove browser-role table grants in one transaction.

Run from services/backend with DATABASE_URL configured in the ignored .env file:
    uv run python -m scripts.migrate_supabase
This does not change Supabase auth/storage schemas or project-wide defaults.
"""

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.persistence import models  # noqa: F401
from app.persistence.database import Base, engine


def migrate():
    with engine.begin() as connection:
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        roles = list(
            connection.scalars(
                text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")
            )
        )
        targets = ["PUBLIC", *roles]
        quote = connection.dialect.identifier_preparer.quote
        table_names = sorted({*Base.metadata.tables, "alembic_version", "system_probe"})
        for table_name in table_names:
            table = f"public.{quote(table_name)}"
            role_sql = ", ".join("PUBLIC" if role == "PUBLIC" else quote(role) for role in targets)
            connection.exec_driver_sql(f"REVOKE ALL PRIVILEGES ON TABLE {table} FROM {role_sql}")
        for role in roles:
            for table_name in table_names:
                allowed = connection.scalar(
                    text("SELECT has_table_privilege(:role, :table, 'SELECT,INSERT,UPDATE,DELETE')"),
                    {"role": role, "table": f"public.{table_name}"},
                )
                if allowed:
                    raise RuntimeError("Browser role still has application table access")
    print("Migrations committed; application tables are not accessible to browser API roles.")


if __name__ == "__main__":
    try:
        migrate()
    except Exception as exc:
        # Do not print a DSN, credentials, SQL parameters or authentication claims.
        print(f"Migration rolled back ({type(exc).__name__}). Inspect configuration locally.")
        raise SystemExit(1) from None
