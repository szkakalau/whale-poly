# tests/test_vw.py

import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

from services.whale_engine.vw import (
    _calc_vw_prices,
    _calc_divergence,
    _calc_uai,
    _calc_velocity,
    _determine_signal,
    compute_vw_metrics,
    prune_vw_snapshots,
)


# ---------------------------------------------------------------------------
# Helpers for async DB/Redis tests
# ---------------------------------------------------------------------------

def _make_result(rows=None, scalar_val=None, rowcount=0):
    """Build a MagicMock that mimics SQLAlchemy Result for text() queries."""
    r = MagicMock()
    if rows is not None:
        r.fetchall.return_value = rows
        r.fetchone.return_value = rows[0] if rows else None
    if scalar_val is not None:
        r.scalar.return_value = scalar_val
    r.rowcount = rowcount
    return r


# ---------------------------------------------------------------------------
# Pure computation tests (unchanged except imports at top)
# ---------------------------------------------------------------------------

class TestCalcVwPrices:
    def test_mixed_yes_no_trades(self):
        """标准场景：YES 和 NO 方向各有交易"""
        trades = [
            # (outcome, amount, price) — amount 为 token 数，price 为 0-1
            ("Yes", Decimal("100"), Decimal("0.60")),
            ("Yes", Decimal("200"), Decimal("0.65")),
            ("No", Decimal("50"), Decimal("0.38")),
        ]
        result = _calc_vw_prices(trades)
        # VW_yes = (100*0.60 + 200*0.65) / (100+200) = 190/300 = 0.6333...
        assert abs(float(result["yes_vw_price"] - Decimal("0.6333333"))) < 0.001
        # VW_no = (50*0.38) / 50 = 0.38
        assert result["no_vw_price"] == Decimal("0.38")
        # volumes
        assert result["yes_volume_usd"] == Decimal("190")  # 100*0.60 + 200*0.65
        assert result["no_volume_usd"] == Decimal("19")     # 50*0.38

    def test_single_direction_only(self):
        """只有 YES 方向交易，NO 方向为空"""
        trades = [
            ("Yes", Decimal("500"), Decimal("0.70")),
            ("Yes", Decimal("300"), Decimal("0.72")),
        ]
        result = _calc_vw_prices(trades)
        assert result["yes_vw_price"] is not None
        assert result["no_vw_price"] is None  # NO 方向无交易
        assert result["no_volume_usd"] == Decimal("0")

    def test_empty_trades(self):
        """空交易列表返回 None"""
        result = _calc_vw_prices([])
        assert result is None


class TestCalcDivergence:
    def test_positive_divergence(self):
        """资金比价格更看好 YES"""
        result = _calc_divergence(
            yes_vw_price=Decimal("0.80"),
            no_vw_price=Decimal("0.20"),
            yes_market_price=Decimal("0.60"),
        )
        # VW_yes_share = 0.80; divergence = 0.80 - 0.60 = 0.20
        assert abs(float(result - Decimal("0.20"))) < 0.001

    def test_negative_divergence(self):
        """资金不如价格看好 YES"""
        result = _calc_divergence(
            yes_vw_price=Decimal("0.45"),
            no_vw_price=Decimal("0.55"),
            yes_market_price=Decimal("0.65"),
        )
        # VW_yes_share = 0.45; divergence = 0.45 - 0.65 = -0.20
        assert abs(float(result - Decimal("-0.20"))) < 0.001


class TestCalcUai:
    def test_underdog_aversion_yes_is_underdog(self):
        """YES 是冷门方（价格<0.5），资金回避 YES"""
        uai = _calc_uai(
            yes_vw_price=Decimal("0.10"),
            no_vw_price=Decimal("0.90"),
            yes_market_price=Decimal("0.15"),
            extreme_threshold=Decimal("0.02"),
        )
        # underdog = YES(0.15); VW_underdog_share = 0.10; UAI = 0.10/0.15 = 0.666...
        assert abs(float(uai - Decimal("0.6667"))) < 0.005

    def test_uai_null_for_extreme_price(self):
        """冷门方价格 < 0.02，UAI 返回 None"""
        uai = _calc_uai(
            yes_vw_price=Decimal("0.005"),
            no_vw_price=Decimal("0.995"),
            yes_market_price=Decimal("0.01"),  # < 0.02
            extreme_threshold=Decimal("0.02"),
        )
        assert uai is None

    def test_uai_no_underdog_price_is_50(self):
        """价格正好 0.5 时无冷门方"""
        uai = _calc_uai(
            yes_vw_price=Decimal("0.50"),
            no_vw_price=Decimal("0.50"),
            yes_market_price=Decimal("0.50"),
            extreme_threshold=Decimal("0.02"),
        )
        assert uai is None


class TestCalcVelocity:
    def test_velocity_normal(self):
        """正常计算 5 分钟速率"""
        v = _calc_velocity(
            divergence_now=Decimal("0.25"),
            divergence_past=Decimal("0.10"),
            minutes=5,
        )
        # (0.25 - 0.10) / 5 = 0.03
        assert float(v) == 0.03

    def test_velocity_past_is_none(self):
        """无历史数据返回 None"""
        v = _calc_velocity(
            divergence_now=Decimal("0.25"),
            divergence_past=None,
            minutes=5,
        )
        assert v is None


class TestDetermineSignal:
    def test_bullish(self):
        direction, strength = _determine_signal(
            divergence=Decimal("0.15"), threshold=Decimal("0.10")
        )
        assert direction == "bullish"
        # strength = min(100, 0.15 * 200) = 30
        assert strength == 30

    def test_bearish(self):
        """看空信号：divergence = -0.15, threshold = 0.10 → bearish, strength=30"""
        direction, strength = _determine_signal(
            divergence=Decimal("-0.15"), threshold=Decimal("0.10")
        )
        assert direction == "bearish"
        assert strength == 30

    def test_neutral(self):
        direction, strength = _determine_signal(
            divergence=Decimal("0.05"), threshold=Decimal("0.10")
        )
        assert direction == "neutral"
        assert strength == 10  # 0.05 * 200


# ---------------------------------------------------------------------------
# Public interface tests (async — mocked DB / Redis)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_compute_vw_metrics_no_active_markets():
    """没有活跃市场时返回 0"""
    mock_session = AsyncMock()
    mock_redis = AsyncMock()
    mock_session.execute.return_value = _make_result(rows=[])

    count = await compute_vw_metrics(mock_session, mock_redis, {})
    assert count == 0


@pytest.mark.asyncio
async def test_compute_vw_metrics_writes_metrics():
    """活跃市场计算后写入 market_vw_metrics（校验 execute 调用次数）"""
    mock_session = AsyncMock()
    mock_redis = AsyncMock()

    mock_session.execute.side_effect = [
        _make_result(rows=[("market_1",)]),               # 0: active markets
        _make_result(rows=[                                # 1: trades
            ("Yes", Decimal("100"), Decimal("0.60")),
            ("No", Decimal("50"), Decimal("0.40")),
        ]),
        _make_result(rows=[(Decimal("0.55"),)]),           # 2: market price
        _make_result(rows=[]),                              # 3: past_5m snapshot
        _make_result(rows=[]),                              # 4: past_15m snapshot
        _make_result(rows=[]),                              # 5: past_1h snapshot
        _make_result(scalar_val=5),                         # 6: snapshot count
        _make_result(rowcount=1),                           # 7: UPSERT metrics
        _make_result(rowcount=1),                           # 8: INSERT snapshot
    ]
    mock_redis.get.return_value = None

    count = await compute_vw_metrics(mock_session, mock_redis, {})
    assert count == 1
    # 9 DB calls: active + trades + price + 3×past + count + upsert + insert
    assert mock_session.execute.call_count == 9


@pytest.mark.asyncio
async def test_prune_vw_snapshots_deletes_old():
    """prune_vw_snapshots 删除过期快照并返回删除数"""
    mock_session = AsyncMock()
    delete_result = MagicMock()
    delete_result.rowcount = 5
    mock_session.execute.return_value = delete_result

    deleted = await prune_vw_snapshots(mock_session, {})
    assert deleted == 5
    mock_session.execute.assert_called_once()
