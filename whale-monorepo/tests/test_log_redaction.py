"""
Tests for `redact_secrets` — the last line of defence against a bot token
reaching a log sink (CR-L1).

Why this file exists: a behavioural test on the Telegram bot runtime caught the
real thing leaking. `redact_secrets` only matched the token when it appeared
*inside* an api.telegram.org URL, but python-telegram-bot reports a bad token as

    InvalidToken: The token `<TOKEN>` was rejected by the server.

i.e. bare, with no URL around it. That is precisely the failure mode most likely
to happen in production (a rotated or revoked token), so the one message an
operator would most need was also the one that printed the credential.
"""
from shared.logging import redact_secrets

TOKEN = "8123456:AAFakeTokenUsedOnlyInTests_doNotLeak"
SECRET = "AAFakeTokenUsedOnlyInTests_doNotLeak"


# ── both shapes must be scrubbed ────────────────────────────────────────────


def test_redacts_bare_token():
    """The shape PTB's InvalidToken uses."""
    msg = f"InvalidToken: The token `{TOKEN}` was rejected by the server."
    out = redact_secrets(msg)
    assert TOKEN not in out
    assert SECRET not in out
    assert "***" in out


def test_redacts_token_embedded_in_url():
    """The shape httpx's HTTPStatusError uses."""
    msg = (
        "Client error '403 Forbidden' for url "
        f"'https://api.telegram.org/bot{TOKEN}/sendMessage' "
        "(connect timeout=5)"
    )
    out = redact_secrets(msg)
    assert TOKEN not in out
    assert SECRET not in out
    # the endpoint must remain identifiable
    assert "https://api.telegram.org/bot***" in out


def test_redacts_multiple_occurrences():
    msg = f"first {TOKEN} and again https://api.telegram.org/bot{TOKEN}/getMe"
    out = redact_secrets(msg)
    assert SECRET not in out
    assert TOKEN not in out


def test_realistic_httpx_error_message():
    """Verbatim-ish httpx wording, which wraps the URL in quotes."""
    msg = (
        "HTTPStatusError: Client error '403 Forbidden' for url "
        f"'https://api.telegram.org/bot{TOKEN}/sendMessage'\n"
        "For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403"
    )
    assert SECRET not in redact_secrets(msg)


# ── must not mangle innocent text ───────────────────────────────────────────


def test_leaves_ordinary_text_alone():
    for text in (
        "OK",
        "",
        "health_telegram_sent chat_id=***7306 status=OK",
        "chat_id=879397306",
        "started 12:30 and finished 13:45",
        "ratio 100:200 accepted",
        "wallet 0x1234567890abcdef",
    ):
        assert redact_secrets(text) == text, f"unexpectedly altered: {text!r}"


def test_leaves_short_secret_after_colon_alone():
    """A colon followed by <30 chars is not a bot token."""
    text = "token abc:shortvalue was rejected"
    assert redact_secrets(text) == text


def test_truncated_token_is_still_not_the_full_secret():
    """Even a near-miss token must not reproduce the secret verbatim."""
    out = redact_secrets(f"InvalidToken: The token `{TOKEN}` was rejected")
    assert SECRET not in out
