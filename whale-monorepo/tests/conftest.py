import os
import sys
import asyncio
import inspect
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.sql.selectable import Select
from sqlalchemy.sql.elements import BindParameter

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
  sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from shared.models.models import TokenCondition, Market, TradeRaw


def pytest_ignore_collect(collection_path, config):
  p = str(collection_path)
  return "/whale-monorepo/scripts/" in p or p.endswith("/whale-monorepo/scripts")


def pytest_configure(config):
  config.addinivalue_line("markers", "asyncio: mark async tests")
  config.addinivalue_line("markers", "integration: integration tests requiring DB + Redis")


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


# Map INSERT param keys to SELECT column names
_COLUMN_ALIASES = {
    "mid": "market_id",
    "tv": "total_volume_usd",
    "yv": "yes_volume_usd",
    "nv": "no_volume_usd",
    "yvp": "yes_vw_price",
    "nvp": "no_vw_price",
    "ymp": "yes_market_price",
    "nmp": "no_market_price",
    "div": "vw_divergence",
    "uai": "uai",
    "v5": "vw_velocity_5m",
    "v15": "vw_velocity_15m",
    "v1h": "vw_velocity_1h",
    "sd": "signal_direction",
    "ss": "signal_strength",
    "st": "status",
    "now": "computed_at",
}

_ALIAS_REVERSE = {v: k for k, v in _COLUMN_ALIASES.items()}


class _FakeRow:
  """Row that supports both attribute access (row.vw_divergence) and index (row[0])."""
  def __init__(self, values=None):
    self._values = tuple(values) if values else ()

  def __getitem__(self, idx):
    return self._values[idx]

  def __getattr__(self, name):
    if name.startswith("_"):
      raise AttributeError(name)
    return None


class _FakeScalars:
  def __init__(self, items):
    self._items = items

  def first(self):
    return self._items[0] if self._items else None


class _FakeResult:
  def __init__(self, items=None, scalar_val=None, rowcount=0):
    self._items = items if items is not None else []
    self._scalar_val = scalar_val
    self.rowcount = rowcount

  def scalars(self):
    if self._scalar_val is not None:
      return _FakeScalars([self._scalar_val])
    return _FakeScalars([self._items[0]._values[0]] if self._items else [])

  def fetchone(self):
    return self._items[0] if self._items else None

  def fetchall(self):
    return self._items

  def scalar(self):
    if self._scalar_val is not None:
      return self._scalar_val
    if self._items:
      return self._items[0]._values[0] if isinstance(self._items[0], _FakeRow) else self._items[0][0]
    return None


class FakeAsyncSession:
  def __init__(self):
    self._token_conditions: dict[str, TokenCondition] = {}
    self._markets: dict[str, Market] = {}
    self._trades: list[TradeRaw] = []
    self._vw_metrics: list[dict] = []
    self._vw_snapshots: list[dict] = []

  def add(self, obj) -> None:
    if isinstance(obj, TokenCondition):
      self._token_conditions[str(obj.token_id).lower()] = obj
    elif isinstance(obj, Market):
      self._markets[obj.id] = obj
    elif isinstance(obj, TradeRaw):
      self._trades.append(obj)

  async def commit(self) -> None:
    return None

  async def execute(self, statement, parameters=None):
    """Handle SQLAlchemy execute() — supports Select, TextClause, and raw SQL strings."""
    # ---- TextClause or raw string --------------------------------------------
    if not isinstance(statement, Select):
      params = parameters if parameters is not None else {}
      sql = str(getattr(statement, 'text', statement))
      return self._handle_raw_sql(sql, params)

    # ---- Select: TokenCondition lookups (existing) ---------------------------
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
    if token_id is not None:
      row = self._token_conditions.get(str(token_id).lower())
      return _FakeResult([row] if row is not None else [])

    return _FakeResult([])

  def _handle_raw_sql(self, sql: str, params: dict):
    """Match SQL patterns and return appropriate results from in-memory data."""
    sql_upper = " ".join(sql.upper().split())

    # ---- DELETE from snapshots -----------------------------------------------
    if sql_upper.startswith("DELETE FROM MARKET_VW_SNAPSHOTS"):
      deleted = len(self._vw_snapshots)
      self._vw_snapshots.clear()
      self._vw_metrics.clear()
      return _FakeResult(rowcount=deleted)

    # ---- INSERT INTO market_vw_snapshots ------------------------------------
    if sql_upper.startswith("INSERT INTO MARKET_VW_SNAPSHOTS"):
      self._vw_snapshots.append(dict(params))
      return _FakeResult(rowcount=1)

    # ---- INSERT INTO market_vw_metrics (UPSERT) -----------------------------
    if sql_upper.startswith("INSERT INTO MARKET_VW_METRICS"):
      self._vw_metrics.append(dict(params))
      return _FakeResult(rowcount=1)

    # ---- COUNT(*) FROM market_vw_snapshots ----------------------------------
    if sql_upper.startswith("SELECT COUNT(*) FROM MARKET_VW_SNAPSHOTS"):
      mid = params.get("mid", "")
      count = sum(1 for s in self._vw_snapshots if s.get("mid") == mid)
      return _FakeResult([_FakeRow((count,))], scalar_val=count)

    # ---- SELECT * FROM market_vw_metrics WHERE market_id = :mid -------------
    if "FROM MARKET_VW_METRICS" in sql_upper and "MARKET_ID = :MID" in sql_upper:
      mid = params.get("mid", "")
      metrics_rows = [m for m in self._vw_metrics if m.get("mid") == mid]
      if not metrics_rows:
        return _FakeResult([])
      m = metrics_rows[-1]
      # Build a row with full column names (map abbreviated INSERT keys)
      row_obj = _FakeRow()
      for k, v in m.items():
        col = _COLUMN_ALIASES.get(k, k)
        setattr(row_obj, col, v)
      return _FakeResult([row_obj])

    # ---- SELECT vw_divergence FROM market_vw_snapshots ... (previous snapshot)-
    if "SELECT VW_DIVERGENCE FROM" in sql_upper or "FROM MARKET_VW_SNAPSHOTS" in sql_upper:
      mid = params.get("mid", "")
      matching = [s for s in self._vw_snapshots if s.get("mid") == mid]
      if matching:
        return _FakeResult([_FakeRow((matching[-1].get("div"),))])
      return _FakeResult([])

    # ---- SELECT price FROM trades_raw ... WHERE outcome = 'Yes' (market price)-
    if "SELECT PRICE FROM TRADES_RAW" in sql_upper and "OUTCOME" in sql_upper:
      mid = params.get("mid", "")
      outcome = "Yes"
      matching = [t for t in self._trades if t.market_id == mid and t.outcome == outcome]
      if matching:
        return _FakeResult([_FakeRow((matching[-1].price,))])
      # Fallback: derive from NO trade price
      no_trades = [t for t in self._trades if t.market_id == mid and t.outcome == "No"]
      if no_trades:
        return _FakeResult([_FakeRow((Decimal("1") - no_trades[-1].price,))])
      return _FakeResult([])

    # ---- SELECT outcome, amount, price FROM trades_raw WHERE market_id = :mid -
    if "SELECT OUTCOME" in sql_upper and "FROM TRADES_RAW" in sql_upper:
      mid = params.get("mid", "")
      matching = [t for t in self._trades if t.market_id == mid]
      rows = [_FakeRow((t.outcome, t.amount, t.price)) for t in matching]
      return _FakeResult(rows)

    # ---- Active markets: JOIN trades_raw + markets ---------------------------
    if "FROM TRADES_RAW T" in sql_upper and "JOIN MARKETS" in sql_upper:
      vol_24h_map: dict[str, Decimal] = {}
      for t in self._trades:
        mid = t.market_id
        if mid not in self._markets:
          continue
        market = self._markets[mid]
        if getattr(market, "status", None) == "closed":
          continue
        vol_24h_map.setdefault(mid, Decimal("0"))
        vol_24h_map[mid] += t.amount * t.price
      min_vol = Decimal(str(params.get("min_vol", 0)))
      rows = [_FakeRow((mid, vol)) for mid, vol in vol_24h_map.items() if vol >= min_vol]
      return _FakeResult(rows)

    # ---- Fallback ------------------------------------------------------------
    return _FakeResult([])


@pytest.fixture
def db_session():
  return FakeAsyncSession()


@pytest.fixture
def redis_client():
  """Fake Redis client for integration tests."""
  client = AsyncMock()
  client.get.return_value = None
  return client
