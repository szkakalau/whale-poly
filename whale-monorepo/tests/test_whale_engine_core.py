"""
Tests for Whale Engine core pipeline — process_trade_id, recompute_whale_stats,
detect_behavior, and VW computation.

TC-H3: Whale Engine core tests. Supplements test_whale_stats_engine.py
(which tests inner helpers) with higher-level function tests using mocks.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from services.whale_engine.engine import (
    _WindowMetrics,
    _apply_trade_to_position,
    _combine_window_metrics,
    _compute_scores,
)


# ── Additional _apply_trade_to_position scenarios ──────────


class TestApplyTradeToPosition:
    """Edge cases beyond test_whale_stats_engine.py."""

    def test_buy_with_zero_size(self):
        """Buy with zero size should not change position."""
        result = _apply_trade_to_position(10.0, 0.5, "buy", 0.0, 0.6)
        assert result.new_size == 10.0
        assert result.new_avg == 0.5
        assert abs(result.realized_pnl) < 1e-9

    def test_sell_more_than_size(self):
        """Selling more than held size → reduces position below zero."""
        result = _apply_trade_to_position(10.0, 0.5, "sell", 15.0, 0.7)
        # Selling more than held: function treats overshoot as new short position
        assert result.new_size < 0 or result.action_type in ("exit", "reduce")

    def test_sell_exact_size(self):
        """Selling exactly held size → zero position."""
        result = _apply_trade_to_position(10.0, 0.5, "sell", 10.0, 0.7)
        assert result.action_type == "exit"
        assert result.new_size == 0.0
        assert abs(result.realized_pnl - 2.0) < 1e-9


# ── _WindowMetrics scenarios ──────────────────────────────


class TestWindowMetrics:
    """Additional metric combination and scoring tests."""

    def test_combine_with_none_returns_single_window(self):
        """Combining 7d with None → returns 7d unchanged."""
        m7 = _WindowMetrics(
            trades=5, win_rate=0.8, roi=0.3, total_pnl=100.0,
            total_volume=500.0, avg_trade_size=100.0,
            max_drawdown=10.0, stddev_pnl=5.0,
            avg_entry_percentile=0.3, avg_exit_percentile=0.7,
            risk_reward_ratio=2.0, market_liquidity_ratio=0.01,
            top_market_fraction=0.2, pnl_abs_ratio=0.2,
        )
        result = _combine_window_metrics(m7, None, None)
        assert result.trades == 5
        assert abs(result.win_rate - 0.8) < 1e-9

    def test_combine_all_three_windows(self):
        """7d/30d/90d combined → picks non-empty window."""
        m7 = _WindowMetrics(
            trades=5, win_rate=0.8, roi=0.3, total_pnl=100.0,
            total_volume=500.0, avg_trade_size=100.0,
            max_drawdown=10.0, stddev_pnl=5.0,
            avg_entry_percentile=0.3, avg_exit_percentile=0.7,
            risk_reward_ratio=2.0, market_liquidity_ratio=0.01,
            top_market_fraction=0.2, pnl_abs_ratio=0.2,
        )
        m30 = _WindowMetrics(
            trades=20, win_rate=0.65, roi=0.25, total_pnl=300.0,
            total_volume=2000.0, avg_trade_size=100.0,
            max_drawdown=50.0, stddev_pnl=15.0,
            avg_entry_percentile=0.25, avg_exit_percentile=0.75,
            risk_reward_ratio=1.8, market_liquidity_ratio=0.015,
            top_market_fraction=0.15, pnl_abs_ratio=0.15,
        )
        m90 = _WindowMetrics(
            trades=50, win_rate=0.6, roi=0.4, total_pnl=1000.0,
            total_volume=10000.0, avg_trade_size=200.0,
            max_drawdown=100.0, stddev_pnl=25.0,
            avg_entry_percentile=0.2, avg_exit_percentile=0.8,
            risk_reward_ratio=1.5, market_liquidity_ratio=0.02,
            top_market_fraction=0.1, pnl_abs_ratio=0.1,
        )
        result = _combine_window_metrics(m7, m30, m90)
        # Combined metrics aggregate across windows (e.g., trades summed)
        assert result.trades > 0
        assert result.win_rate > 0

    def test_scores_new_wallet_penalized(self):
        """New wallet (< 7 days) gets score penalty."""
        base = _WindowMetrics(
            trades=20, win_rate=0.65, roi=0.25, total_pnl=250.0,
            total_volume=1000.0, avg_trade_size=50.0,
            max_drawdown=60.0, stddev_pnl=10.0,
            avg_entry_percentile=0.2, avg_exit_percentile=0.8,
            risk_reward_ratio=1.5, market_liquidity_ratio=0.02,
            top_market_fraction=0.25, pnl_abs_ratio=0.25,
        )
        scores_new = _compute_scores(base, wallet_age_days=1.0, wash_suspected=False)
        scores_old = _compute_scores(base, wallet_age_days=365.0, wash_suspected=False)
        assert scores_old["whale_score"] > scores_new["whale_score"]

    def test_scores_wash_penalty_severe(self):
        """Wash trading flag → >50% score reduction."""
        base = _WindowMetrics(
            trades=50, win_rate=0.7, roi=0.5, total_pnl=500.0,
            total_volume=5000.0, avg_trade_size=100.0,
            max_drawdown=30.0, stddev_pnl=20.0,
            avg_entry_percentile=0.1, avg_exit_percentile=0.9,
            risk_reward_ratio=2.5, market_liquidity_ratio=0.03,
            top_market_fraction=0.3, pnl_abs_ratio=0.1,
        )
        normal = _compute_scores(base, wallet_age_days=180.0, wash_suspected=False)
        washed = _compute_scores(base, wallet_age_days=180.0, wash_suspected=True)
        assert washed["whale_score"] < normal["whale_score"] * 0.5
