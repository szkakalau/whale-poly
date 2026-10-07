"""
Tests for the alert message templates.

Regression target: alerts are sent with ``parse_mode="HTML"``, but the message
body interpolated market titles / wallet names verbatim. A single ``&`` or ``<``
in a Polymarket market title makes Telegram reject the *entire* message with
`400 Bad Request: can't parse entities`, so that alert never arrives — and in
the pre-fix code the failure was invisible. These tests pin the escaping.

They also pin the opposite failure: escaping must not swallow the intentional
markup (``<b>``, ``<code>``) that the templates rely on.
"""
from services.telegram_bot.templates import format_alert, format_digest_lines

TID = "879397306"


def _payload(**over):
    base = {
        "market_title": "Bitcoin Up or Down on October 5?",
        "market_id": "0xabc",
        "alert_type": "whale_entry",
        "outcome": "Yes",
        "side": "BUY",
        "size": 12345.67,
        "price": 0.6123,
        "score": 80,
        "signal_level": "",
        "wallet": "0x1234567890abcdef1234",
    }
    base.update(over)
    return base


# ── the markup the templates intend to keep ─────────────────────────────────


def test_intended_markup_survives():
    body = format_alert(_payload(), TID)
    assert "<b>" in body and "</b>" in body
    assert "<code>" in body and "</code>" in body


def test_clean_title_is_not_mangled():
    body = format_alert(_payload(), TID)
    assert "Bitcoin Up or Down on October 5?" in body


# ── the bug: unescaped text used to break HTML parsing ──────────────────────


def test_ampersand_in_title_is_escaped():
    body = format_alert(_payload(market_title="Will A & B happen?"), TID)
    assert "&amp;" in body
    assert "A & B" not in body, "a bare `&` makes Telegram reject the whole message"


def test_angle_brackets_in_title_are_escaped():
    body = format_alert(_payload(market_title="Is <script> a market?"), TID)
    assert "<script>" not in body
    assert "&lt;script&gt;" in body


def test_escaping_never_produces_a_bare_ampersand():
    """Whatever goes in, the only `&` characters left must start an entity."""
    dirty = 'A & B <i>c</i> "d" & <script>alert(1)</script>'
    body = format_alert(_payload(market_title=dirty, outcome=dirty), TID)
    import re

    for m in re.finditer(r"&", body):
        tail = body[m.start():m.start() + 8]
        assert re.match(r"&(amp|lt|gt|quot|#\d+);", tail), f"unescaped '&' near {tail!r}"


def test_wallet_name_is_escaped():
    body = format_alert(_payload(wallet_name="Whale & Co <b>fake</b>"), TID)
    assert "Whale &amp; Co" in body
    assert "<b>fake</b>" not in body


def test_non_numeric_size_falls_back_escaped():
    """The numeric formatters fall back to `str(x)` — that path must escape too."""
    body = format_alert(_payload(size="lots & lots"), TID)
    assert "lots &amp; lots" in body


# ── digest lines ────────────────────────────────────────────────────────────


def test_digest_escapes_title_and_wallet():
    raw = (
        '{"market_title": "A & B <b>x</b>", '
        '"wallet_address": "0xabcdef1234567890", "whale_score": 80}'
    )
    out = format_digest_lines([raw], TID)
    assert "&amp;" in out
    assert "<b>x</b>" not in out
    assert "&lt;b&gt;x&lt;/b&gt;" in out
    # the digest's own markup must survive
    assert "<code>" in out


def test_digest_tolerates_invalid_items():
    out = format_digest_lines(["not json"], TID)
    assert "parse error" in out
