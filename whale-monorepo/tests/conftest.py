import os
import sys
import asyncio
import inspect
from pathlib import Path

import pytest
from sqlalchemy.sql.selectable import Select
from sqlalchemy.sql.elements import BindParameter

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
  sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from shared.models.models import TokenCondition


def pytest_ignore_collect(collection_path, config):
  p = str(collection_path)
  return "/whale-monorepo/scripts/" in p or p.endswith("/whale-monorepo/scripts")


def pytest_pyfunc_call(pyfuncitem):
  testfunction = pyfuncitem.obj
  if not inspect.iscoroutinefunction(testfunction):
    return None
  funcargs = {name: pyfuncitem.funcargs[name] for name in pyfuncitem._fixtureinfo.argnames}
  loop = asyncio.new_event_loop()
  asyncio.set_event_loop(loop)
  try:
    loop.run_until_complete(testfunction(**funcargs))
  finally:
    loop.close()
  return True


class _FakeScalars:
  def __init__(self, items):
    self._items = items

  def first(self):
    return self._items[0] if self._items else None


class _FakeResult:
  def __init__(self, items):
    self._items = items

  def scalars(self):
    return _FakeScalars(self._items)


class FakeAsyncSession:
  def __init__(self):
    self._token_conditions: dict[str, TokenCondition] = {}

  def add(self, obj) -> None:
    if isinstance(obj, TokenCondition):
      self._token_conditions[str(obj.token_id).lower()] = obj

  async def commit(self) -> None:
    return None

  async def execute(self, statement):
    if isinstance(statement, Select):
      token_id = None
      for crit in getattr(statement, "_where_criteria", []):
        left = getattr(crit, "left", None)
        right = getattr(crit, "right", None)
        if getattr(left, "name", None) != "token_id":
          continue
        if isinstance(right, BindParameter):
          token_id = right.value
        elif hasattr(right, "value"):
          token_id = right.value
      if token_id is None:
        return _FakeResult([])
      row = self._token_conditions.get(str(token_id).lower())
      return _FakeResult([row] if row is not None else [])

    table = getattr(statement, "table", None)
    if table is not None and getattr(table, "name", None) == "token_conditions":
      params = statement.compile().params
      token_id = str(params.get("token_id") or "").lower()
      if token_id:
        existing = self._token_conditions.get(token_id)
        if existing is None:
          existing = TokenCondition(
            token_id=token_id,
            condition_id=str(params.get("condition_id") or "unknown"),
            market_id=str(params.get("market_id") or "unknown"),
            question=str(params.get("question") or "unknown"),
          )
          self._token_conditions[token_id] = existing
        else:
          existing.condition_id = str(params.get("condition_id") or existing.condition_id)
          existing.market_id = str(params.get("market_id") or existing.market_id)
          existing.question = str(params.get("question") or existing.question)
      return _FakeResult([])

    return _FakeResult([])


@pytest.fixture
def db_session():
  return FakeAsyncSession()
