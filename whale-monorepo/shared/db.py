from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from shared.config import settings


engine = create_async_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=20,
    pool_recycle=3600,       # Recycle connections after 1 hour to prevent stale connections
    pool_pre_ping=True,      # Verify connections before use
    pool_timeout=30,         # Wait up to 30s for a connection before failing
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
  async with SessionLocal() as session:
    yield session


def insert(table):
  """
  Cross-dialect insert with on_conflict support.
  """
  if "sqlite" in settings.database_url:
    return sqlite_insert(table)
  return pg_insert(table)

