from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
  should_alert: bool
  reason: str
  signal_level: str


def should_alert(*, whale_score: int, trade_usd: float, min_score: int, min_usd: float, always_score: int) -> Decision:
  s = int(whale_score)
  usd = float(trade_usd)

  # always_score bypasses all other checks — highest priority
  if s >= always_score:
    return Decision(True, "always_score", "high")

  # Absolute floor to filter noise trades
  if usd < 100:
    return Decision(False, "trade_tiny", "none")

  # Plan-tier gating — these values come from alert_engine_config.yaml
  if s < min_score:
    return Decision(False, "score_low", "none")
  if usd < min_usd:
    return Decision(False, "trade_small", "none")

  # Signal passed all gates — determine strength
  if s >= always_score - 5:
    return Decision(True, "high_threshold", "high")
  return Decision(True, "threshold_met", "low")
