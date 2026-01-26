from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
  should_alert: bool
  reason: str


def should_alert(*, whale_score: int, trade_usd: float, min_score: int, min_usd: float, always_score: int) -> Decision:
  s = int(whale_score)
  usd = float(trade_usd)
  if s >= always_score:
    return Decision(True, "always_score")
  if s < min_score:
    return Decision(False, "score_low")
  if usd < min_usd:
    return Decision(False, "trade_small")
  return Decision(True, "rule_pass")

