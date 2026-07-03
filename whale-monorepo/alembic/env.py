import asyncio

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from shared.config import settings
from shared.models import Base

# settings already calls load_dotenv() at module level

config = context.config
target_metadata = Base.metadata


def get_database_url() -> str:
  """Return the normalized database URL from shared settings."""
  return settings.database_url


def run_migrations_offline() -> None:
  url = get_database_url()
  context.configure(
    url=url,
    target_metadata=target_metadata,
    literal_binds=True,
    dialect_opts={"paramstyle": "named"},
    compare_type=True,
  )

  with context.begin_transaction():
    context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
  context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
  with context.begin_transaction():
    context.run_migrations()


async def run_migrations_online() -> None:
  configuration = config.get_section(config.config_ini_section) or {}
  configuration["sqlalchemy.url"] = get_database_url()
  connectable = async_engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)
  async with connectable.connect() as connection:
    await connection.run_sync(do_run_migrations)
  await connectable.dispose()


if context.is_offline_mode():
  run_migrations_offline()
else:
  asyncio.run(run_migrations_online())
