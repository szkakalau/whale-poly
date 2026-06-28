# tests/test_vw.py

import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone

# 将被测函数 import（此时函数尚不存在，测试将失败）
# from services.whale_engine.vw import (
#     _calc_vw_prices,
#     _calc_divergence,
#     _calc_uai,
#     _calc_velocity,
#     _determine_signal,
# )


class TestCalcVwPrices:
    def test_mixed_yes_no_trades(self):
        """标准场景：YES 和 NO 方向各有交易"""
        trades = [
            # (outcome, amount, price) — amount 为 token 数，price 为 0-1
            ("Yes", Decimal("100"), Decimal("0.60")),
            ("Yes", Decimal("200"), Decimal("0.65")),
            ("No", Decimal("50"), Decimal("0.38")),
        ]
        from services.whale_engine.vw import _calc_vw_prices
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
        from services.whale_engine.vw import _calc_vw_prices
        result = _calc_vw_prices(trades)
        assert result["yes_vw_price"] is not None
        assert result["no_vw_price"] is None  # NO 方向无交易
        assert result["no_volume_usd"] == Decimal("0")

    def test_empty_trades(self):
        """空交易列表返回 None"""
        from services.whale_engine.vw import _calc_vw_prices
        result = _calc_vw_prices([])
        assert result is None


class TestCalcDivergence:
    def test_positive_divergence(self):
        """资金比价格更看好 YES"""
        from services.whale_engine.vw import _calc_divergence
        result = _calc_divergence(
            yes_vw_price=Decimal("0.80"),
            no_vw_price=Decimal("0.20"),
            yes_market_price=Decimal("0.60"),
        )
        # VW_yes_share = 0.80; divergence = 0.80 - 0.60 = 0.20
        assert abs(float(result - Decimal("0.20"))) < 0.001

    def test_negative_divergence(self):
        """资金不如价格看好 YES"""
        from services.whale_engine.vw import _calc_divergence
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
        from services.whale_engine.vw import _calc_uai
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
        from services.whale_engine.vw import _calc_uai
        uai = _calc_uai(
            yes_vw_price=Decimal("0.005"),
            no_vw_price=Decimal("0.995"),
            yes_market_price=Decimal("0.01"),  # < 0.02
            extreme_threshold=Decimal("0.02"),
        )
        assert uai is None

    def test_uai_no_underdog_price_is_50(self):
        """价格正好 0.5 时无冷门方"""
        from services.whale_engine.vw import _calc_uai
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
        from services.whale_engine.vw import _calc_velocity
        v = _calc_velocity(
            divergence_now=Decimal("0.25"),
            divergence_past=Decimal("0.10"),
            minutes=5,
        )
        # (0.25 - 0.10) / 5 = 0.03
        assert float(v) == 0.03

    def test_velocity_past_is_none(self):
        """无历史数据返回 None"""
        from services.whale_engine.vw import _calc_velocity
        v = _calc_velocity(
            divergence_now=Decimal("0.25"),
            divergence_past=None,
            minutes=5,
        )
        assert v is None


class TestDetermineSignal:
    def test_bullish(self):
        from services.whale_engine.vw import _determine_signal
        direction, strength = _determine_signal(
            divergence=Decimal("0.15"), threshold=Decimal("0.10")
        )
        assert direction == "bullish"
        # strength = min(100, 0.15 * 200) = 30
        assert strength == 30

    def test_neutral(self):
        from services.whale_engine.vw import _determine_signal
        direction, strength = _determine_signal(
            divergence=Decimal("0.05"), threshold=Decimal("0.10")
        )
        assert direction == "neutral"
        assert strength == 10  # 0.05 * 200
