from services.alert_engine.rules import should_alert


def test_always_score_alerts():
  d = should_alert(whale_score=85, trade_usd=1, min_score=75, min_usd=1000, always_score=85)
  assert d.should_alert is True


def test_threshold_alerts():
  d = should_alert(whale_score=75, trade_usd=1000, min_score=75, min_usd=1000, always_score=85)
  assert d.should_alert is True


def test_score_low():
  d = should_alert(whale_score=74, trade_usd=999999, min_score=75, min_usd=1000, always_score=85)
  assert d.should_alert is False


def test_trade_small():
  d = should_alert(whale_score=80, trade_usd=999, min_score=75, min_usd=1000, always_score=85)
  assert d.should_alert is False
