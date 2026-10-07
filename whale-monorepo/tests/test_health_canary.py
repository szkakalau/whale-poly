"""
Tests for the hourly health-check Telegram canary (D6 defect).

The Telegram Bot API answers 4xx/5xx *without raising*, so the original
``await client.post(...)`` discarded every rejection silently: a 403 ("bot
can't initiate conversation with a user" — nobody pressed /start for THIS bot),
a 401 (bad token) and a 400 (bad chat_id) were all indistinguishable from
success. Because this canary is the operator's only signal that the whole
chain is alive, its own blindness is the worst possible place for a silent
failure.

These are *behavioural* tests: they drive the real coroutine with a faked
httpx transport and assert on the emitted log records. Stronger than an AST
contract here, because the failure mode was "we never looked at the response
object" — so we assert that a response object is inspected.
"""
import asyncio
import logging
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from services.unified import worker_loop

TOKEN = "8123456:AAFakeTokenUsedOnlyInTests_doNotLeak"
CHAT_ID = "879397306"


# ── fakes ────────────────────────────────────────────────────────────────────


class _FakeResponse:
    def __init__(self, status_code, payload=None, raise_on_json=False):
        self.status_code = status_code
        self._payload = payload
        self._raise_on_json = raise_on_json

    def json(self):
        if self._raise_on_json or self._payload is None:
            raise ValueError("not json")
        return self._payload


class _FakeAsyncClient:
    """Stand-in for httpx.AsyncClient used as an async context manager."""

    last: "_FakeAsyncClient | None" = None

    def __init__(self, response=None, exc=None):
        self._response = response
        self._exc = exc
        self.posts = []
        _FakeAsyncClient.last = self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def post(self, url, **kwargs):
        self.posts.append((url, kwargs))
        if self._exc is not None:
            raise self._exc
        return self._response


def _install(response=None, exc=None):
    """Patch httpx.AsyncClient inside worker_loop for the duration of a test."""
    return patch.object(
        worker_loop.httpx, "AsyncClient", lambda *a, **k: _FakeAsyncClient(response, exc)
    )


async def _send():
    return await worker_loop._send_health_telegram(
        "health-check-1", datetime.now(timezone.utc), "OK"
    )


def _records(caplog):
    return [r for r in caplog.records if r.name.startswith("unified.worker_loop")]


# ── 200: success is recorded ────────────────────────────────────────────────


async def test_success_is_logged(caplog):
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
         _install(_FakeResponse(200, {"ok": True, "result": {}})):
        await _send()

    assert any("health_telegram_sent" in r.getMessage() for r in _records(caplog))
    assert not any(r.levelno >= logging.ERROR for r in _records(caplog))


# ── 403 / 401 / 400: rejections must be loud, with Telegram's own wording ───


async def test_403_is_reported_with_description(caplog):
    """The classic case: the chat never pressed /start for the health bot."""
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
         _install(
             _FakeResponse(
                 403,
                 {
                     "ok": False,
                     "error_code": 403,
                     "description": "Forbidden: bot can't initiate conversation with a user",
                 },
             )
         ):
        await _send()

    errors = [r for r in _records(caplog) if r.levelno >= logging.ERROR]
    assert errors, "a 403 must produce an ERROR record"
    msg = errors[0].getMessage()
    assert "health_telegram_rejected" in msg
    assert "403" in msg
    assert "Forbidden" in msg, "Telegram's description is what makes the cause actionable"
    assert not any("health_telegram_sent" in r.getMessage() for r in _records(caplog))


async def test_401_bad_token_is_reported(caplog):
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
         _install(_FakeResponse(401, {"ok": False, "error_code": 401,
                                      "description": "Unauthorized"})):
        await _send()

    msgs = [r.getMessage() for r in _records(caplog)]
    assert any("health_telegram_rejected" in m and "401" in m for m in msgs)


async def test_400_bad_chat_id_is_reported(caplog):
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
         _install(_FakeResponse(400, {"ok": False, "error_code": 400,
                                      "description": "Bad Request: chat not found"})):
        await _send()

    msgs = [r.getMessage() for r in _records(caplog)]
    assert any("health_telegram_rejected" in m and "400" in m for m in msgs)


async def test_rejection_without_json_body_is_still_reported(caplog):
    """A 502 from an intermediary may not carry a JSON body at all."""
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
         _install(_FakeResponse(502, raise_on_json=True)):
        await _send()

    msgs = [r.getMessage() for r in _records(caplog)]
    assert any("health_telegram_rejected" in m and "502" in m for m in msgs)


# ── transport failures ──────────────────────────────────────────────────────


async def test_transport_error_is_logged(caplog):
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
         _install(exc=RuntimeError("connection reset")):
        await _send()

    msgs = [r.getMessage() for r in _records(caplog)]
    assert any("health_telegram_failed" in m for m in msgs)


# ── unconfigured: the absence itself must be visible ────────────────────────


async def test_missing_config_is_logged_not_silent(caplog):
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", ""), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID):
        await _send()

    msgs = [r.getMessage() for r in _records(caplog)]
    assert any("health_telegram_skipped" in m for m in msgs), (
        "an unconfigured canary must warn — otherwise 'the hourly check never "
        "arrived' has no trace anywhere"
    )


# ── the token must never reach the logs ─────────────────────────────────────


async def test_token_never_leaks_into_logs(caplog):
    caplog.set_level(logging.INFO)
    for response, exc in (
        (_FakeResponse(200, {"ok": True}), None),
        (_FakeResponse(403, {"ok": False, "description": "Forbidden"}), None),
        (None, RuntimeError(f"boom while posting to https://api.telegram.org/bot{TOKEN}/sendMessage")),
    ):
        caplog.clear()
        with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
             patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
             _install(response, exc):
            await _send()
        assert TOKEN not in caplog.text, "the bot token must never be logged"


# ── health_check_loop: unconfigured must warn ───────────────────────────────


class _StopLoop(Exception):
    pass


class _FakeSession:
    async def execute(self, *args, **kwargs):
        return None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False


async def _drive_health_loop_once():
    """Run health_check_loop through exactly one iteration, then abort."""
    calls = {"n": 0}

    async def fake_sleep(_seconds):
        calls["n"] += 1
        if calls["n"] >= 2:  # 1st = initial delay, 2nd = post-iteration sleep
            raise _StopLoop()
        return None  # NB: must not call asyncio.sleep here — it is patched

    with patch.object(worker_loop.asyncio, "sleep", fake_sleep), \
         patch.object(worker_loop, "SessionLocal", lambda: _FakeSession()):
        try:
            await worker_loop.health_check_loop()
        except _StopLoop:
            pass


async def test_loop_warns_when_canary_unconfigured(caplog):
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", ""), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", ""):
        await _drive_health_loop_once()

    msgs = [r.getMessage() for r in _records(caplog)]
    assert any("health_telegram_not_configured" in m for m in msgs)


async def test_loop_actually_sends_when_configured(caplog):
    caplog.set_level(logging.INFO)
    with patch.object(worker_loop.settings, "telegram_health_bot_token", TOKEN), \
         patch.object(worker_loop.settings, "telegram_health_chat_id", CHAT_ID), \
         _install(_FakeResponse(200, {"ok": True})):
        await _drive_health_loop_once()

    client = _FakeAsyncClient.last
    assert client and client.posts, "the loop must reach the Telegram API"
    url, kwargs = client.posts[0]
    assert url.endswith("/sendMessage")
    assert kwargs["json"]["chat_id"] == CHAT_ID
    assert "全链路检查结果" in kwargs["json"]["text"]
    assert any("health_telegram_sent" in r.getMessage() for r in _records(caplog))


# ── bot runtime: an invalid token must not die silently ─────────────────────


class _ExplodingApplication:
    """Stands in for a PTB Application whose token was rotated/revoked."""

    def __init__(self, exc):
        self._exc = exc
        self.updater = self

    async def initialize(self):
        raise self._exc

    async def start(self):
        raise AssertionError("must not reach start() after a failed initialize()")

    async def updater_stop(self):
        pass


async def test_runtime_logs_and_reraises_when_initialize_fails(caplog):
    """Bot.initialize() calls getMe(), so a bad token fails there. The task used
    to die with no log at all — polling simply never started."""
    caplog.set_level(logging.INFO)
    app = _ExplodingApplication(
        RuntimeError(f"InvalidToken: The token {TOKEN} was rejected by the server.")
    )
    with pytest.raises(RuntimeError):
        await worker_loop.telegram_bot_runtime_loop(app, asyncio.Event())

    msgs = [r.getMessage() for r in _records(caplog)]
    assert any("telegram_bot_initialize_failed" in m for m in msgs), (
        "an unusable bot token must be logged, not silently fatal"
    )
    assert any("InvalidToken" in m for m in msgs), "the cause must be identifiable"
    assert TOKEN not in caplog.text, "the bot token must never be logged"


async def test_runtime_reaches_polling_when_initialize_succeeds(caplog):
    caplog.set_level(logging.INFO)
    started = {"polling": False, "commands": False}

    class _OkApplication:
        def __init__(self):
            self.updater = self

        async def initialize(self):
            return None

        async def start(self):
            return None

        async def set_my_commands(self, _cmds):
            started["commands"] = True

        async def start_polling(self, **kwargs):
            started["polling"] = True
            raise _StopLoop()  # break out of the wait

        async def stop(self):
            return None

        async def shutdown(self):
            return None

        async def updater_stop(self):
            return None

    app = _OkApplication()
    app.bot = app
    with pytest.raises(_StopLoop):
        await worker_loop.telegram_bot_runtime_loop(app, asyncio.Event())
    assert started["commands"] and started["polling"]


# ── F4: the error latch must mean "the LAST iteration failed" ────────────────
#
# _err() used to be permanent: once a loop hit a single transient failure,
# `has_error` stayed true for the lifetime of the process. /health therefore
# reported a broken worker forever, which trains operators to ignore the field
# — i.e. the alarm that is always on is the alarm that is never read. The latch
# is now cleared by the next successful _beat(), so it reports current state.


def _probe(name):
    """Reset a worker name in the global registry so tests cannot leak into each other."""
    worker_loop._worker_has_error.pop(name, None)
    worker_loop._worker_heartbeats.pop(name, None)
    return name


def _clear(name):
    worker_loop._worker_has_error.pop(name, None)
    worker_loop._worker_heartbeats.pop(name, None)


def test_error_latch_is_cleared_by_the_next_successful_beat():
    name = _probe("f4-transient")
    try:
        worker_loop._beat(name)  # a loop registers itself by completing one iteration
        worker_loop._err(name)
        assert worker_loop.get_worker_status()[name]["has_error"] is True

        worker_loop._beat(name)
        assert worker_loop.get_worker_status()[name]["has_error"] is False, (
            "a worker that recovered must stop reporting an error, otherwise "
            "the latch is a false-positive that is never cleared"
        )
    finally:
        _clear(name)


def test_error_latch_stays_set_while_the_worker_is_still_failing():
    """The fix must not blind /health: a worker that keeps failing keeps reporting."""
    name = _probe("f4-persistent")
    try:
        worker_loop._beat(name)
        for _ in range(3):
            worker_loop._err(name)
        assert worker_loop.get_worker_status()[name]["has_error"] is True
    finally:
        _clear(name)


def test_beat_still_refreshes_the_timestamp():
    """Clearing the latch must not replace the heartbeat update (regression guard)."""
    name = _probe("f4-beat-ts")
    try:
        worker_loop._beat(name)
        info = worker_loop.get_worker_status()[name]
        assert info["last_beat_sec"] < 1.0, "the beat must record a fresh timestamp"
    finally:
        _clear(name)


def test_worker_that_never_beat_is_invisible_to_health():
    """Known limitation, pinned so it is not mistaken for coverage.

    get_worker_status() iterates _worker_heartbeats only, so a loop that _err()s
    before ever completing one iteration appears nowhere in /health — the most
    broken state is the one state the field cannot report. Recorded here because
    it bounds what F4 can promise; fixing it would require tracking errored
    workers in a separate registry and is out of scope for this change.
    """
    name = _probe("f4-never-beat")
    try:
        worker_loop._err(name)
        assert name not in worker_loop.get_worker_status(), (
            "documenting current behaviour: an errored-but-never-beaten worker is absent"
        )
        assert worker_loop._worker_has_error.get(name) is True, (
            "the latch itself is set — only the status projection drops it"
        )
    finally:
        _clear(name)
