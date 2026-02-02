from services.whale_engine.engine import (
  _WindowMetrics,
  _combine_window_metrics,
  _apply_trade_to_position,
  _compute_scores,
)


def test_apply_trade_to_position_realized_pnl_and_actions():
  u1 = _apply_trade_to_position(0.0, 0.0, "buy", 10.0, 0.4)
  assert u1.action_type == "entry"
  assert u1.new_size == 10.0
  assert abs(u1.new_avg - 0.4) < 1e-9
  assert abs(u1.realized_pnl - 0.0) < 1e-9

  u2 = _apply_trade_to_position(u1.new_size, u1.new_avg, "buy", 10.0, 0.6)
  assert u2.action_type == "add"
  assert u2.new_size == 20.0
  assert abs(u2.new_avg - 0.5) < 1e-9
  assert abs(u2.realized_pnl - 0.0) < 1e-9

  u3 = _apply_trade_to_position(u2.new_size, u2.new_avg, "sell", 5.0, 0.7)
  assert u3.action_type == "reduce"
  assert u3.new_size == 15.0
  assert abs(u3.new_avg - 0.5) < 1e-9
  assert abs(u3.realized_pnl - 1.0) < 1e-9

  u4 = _apply_trade_to_position(u3.new_size, u3.new_avg, "sell", 15.0, 0.4)
  assert u4.action_type == "exit"
  assert abs(u4.new_size - 0.0) < 1e-9
  assert abs(u4.new_avg - 0.0) < 1e-9
  assert abs(u4.realized_pnl - (-1.5)) < 1e-9


def test_combine_window_metrics_ignores_small_samples():
  m7 = _WindowMetrics(
    trades=2,
    win_rate=1.0,
    roi=1.0,
    total_pnl=100.0,
    total_volume=100.0,
    avg_trade_size=50.0,
    max_drawdown=0.0,
    stddev_pnl=0.0,
    avg_entry_percentile=0.1,
    avg_exit_percentile=0.9,
    risk_reward_ratio=2.0,
    market_liquidity_ratio=0.02,
    top_market_fraction=0.5,
    pnl_abs_ratio=1.0,
  )
  m30 = _WindowMetrics(
    trades=10,
    win_rate=0.6,
    roi=0.2,
    total_pnl=200.0,
    total_volume=1000.0,
    avg_trade_size=100.0,
    max_drawdown=50.0,
    stddev_pnl=5.0,
    avg_entry_percentile=0.4,
    avg_exit_percentile=0.6,
    risk_reward_ratio=1.2,
    market_liquidity_ratio=0.01,
    top_market_fraction=0.3,
    pnl_abs_ratio=0.2,
  )
  combined = _combine_window_metrics(m7, m30, None)
  assert combined.trades == 10
  assert abs(combined.win_rate - 0.6) < 1e-9
  assert abs(combined.roi - 0.2) < 1e-9


def test_compute_scores_applies_wallet_age_and_wash_penalties():
  base = _WindowMetrics(
    trades=20,
    win_rate=0.65,
    roi=0.25,
    total_pnl=250.0,
    total_volume=1000.0,
    avg_trade_size=50.0,
    max_drawdown=60.0,
    stddev_pnl=10.0,
    avg_entry_percentile=0.2,
    avg_exit_percentile=0.8,
    risk_reward_ratio=1.5,
    market_liquidity_ratio=0.02,
    top_market_fraction=0.25,
    pnl_abs_ratio=0.25,
  )
  s_old = _compute_scores(base, wallet_age_days=30.0, wash_suspected=False)
  s_new = _compute_scores(base, wallet_age_days=3.0, wash_suspected=False)
  assert s_old["whale_score"] > s_new["whale_score"]

  s_wash = _compute_scores(base, wallet_age_days=30.0, wash_suspected=True)
  assert s_wash["whale_score"] < s_old["whale_score"] * 0.5
