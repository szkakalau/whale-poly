from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from shared.config import settings


engine = create_async_engine(settings.database_url, pool_pre_ping=True)
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

