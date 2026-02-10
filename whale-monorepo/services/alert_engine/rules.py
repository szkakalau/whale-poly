from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
  should_alert: bool
  reason: str
  signal_level: str


def should_alert(*, whale_score: int, trade_usd: float, min_score: int, min_usd: float, always_score: int) -> Decision:
  s = int(whale_score)
  usd = float(trade_usd)
  _ = (min_score, min_usd)

  if s >= always_score:
    return Decision(True, "always_score", "high")
  if usd < 100:
    return Decision(False, "trade_tiny", "none")
  if s >= 85 and usd >= 400:
    return Decision(True, "high_threshold", "high")
  if s >= 70 and usd >= 2500:
    return Decision(True, "low_confidence", "low")
  if s < 70:
    return Decision(False, "score_low", "none")
  return Decision(False, "trade_small", "none")
