from alembic import context

from app.persistence import models  # noqa: F401
from app.persistence.database import Base, engine

if context.is_offline_mode():
    from app.config import settings

    context.configure(
        url=settings.database_url, target_metadata=Base.metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    def run_migrations(connection):
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()

    supplied_connection = context.config.attributes.get("connection")
    if supplied_connection is not None:
        run_migrations(supplied_connection)
    else:
        with engine.connect() as connection:
            run_migrations(connection)
