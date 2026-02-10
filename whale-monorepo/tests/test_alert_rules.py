from services.alert_engine.rules import should_alert


def test_always_score_alerts():
  d = should_alert(whale_score=85, trade_usd=1, min_score=75, min_usd=1000, always_score=85)
  assert d.should_alert is True
  assert d.reason == "always_score"
  assert d.signal_level == "high"


def test_threshold_alerts():
  d = should_alert(whale_score=85, trade_usd=400, min_score=75, min_usd=1000, always_score=90)
  assert d.should_alert is True
  assert d.signal_level == "high"


def test_low_confidence_alerts():
  d = should_alert(whale_score=70, trade_usd=2500, min_score=75, min_usd=1000, always_score=90)
  assert d.should_alert is True
  assert d.signal_level == "low"


def test_score_low():
  d = should_alert(whale_score=69, trade_usd=999999, min_score=75, min_usd=1000, always_score=85)
  assert d.should_alert is False


def test_trade_small():
  d = should_alert(whale_score=80, trade_usd=999, min_score=75, min_usd=1000, always_score=85)
  assert d.should_alert is False
  assert d.signal_level == "none"
