from collections.abc import AsyncIterator
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from shared.config import settings


# Connection pool sizing (CR-DB1): the production Postgres is a 20-connection
# Basic instance. A 20+20 pool here plus Vercel's direct Prisma connections
# exhausted all slots and starved every worker (symptoms: 30s query timeouts,
# stale worker heartbeats, hanging build prerenders). Keep the pool small and
# fail fast — the queue-based workers never need deep concurrency.
_POOL_SIZE = int(os.getenv("DATABASE_POOL_SIZE", "5"))
_MAX_OVERFLOW = int(os.getenv("DATABASE_MAX_OVERFLOW", "5"))
_POOL_TIMEOUT = int(os.getenv("DATABASE_POOL_TIMEOUT", "10"))


engine = create_async_engine(
    settings.database_url,
    pool_size=_POOL_SIZE,
    max_overflow=_MAX_OVERFLOW,
    pool_recycle=3600,       # Recycle connections after 1 hour to prevent stale connections
    pool_pre_ping=True,      # Verify connections before use
    pool_timeout=_POOL_TIMEOUT,  # Fail fast instead of hanging when slots are exhausted
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

