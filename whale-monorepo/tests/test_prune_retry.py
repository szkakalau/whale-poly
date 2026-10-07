"""prune_trades_raw_loop — startup delay + failure backoff.

Regression tests for the 2026-10-07 production error
`unified.worker_loop prune_trades_raw_failed -> QueryCanceledError: statement timeout`:

The loop used to run its first cycle the instant it started — i.e. while every
other worker was booting and the page cache was cold — where the backlog DELETE
could exceed its 30s statement_timeout. The exception then slept the full
`interval` (24h), so one unlucky start left trades_raw un-pruned for a whole day.

Guard rails pinned here:
  * a startup delay runs before the first cycle, so it does not race the boot;
  * a failed cycle retries after a short backoff instead of waiting 24h.
"""
import pytest

from services.unified import worker_loop


class _Stop(Exception):
    """Sentinel used to break out of the loop under test."""


def _patch_sleep(monkeypatch, *, max_calls: int = 4):
    """Record every sleep duration; raise _Stop on the Nth call."""
    sleeps: list[float] = []

    async def _fake_sleep(seconds, *args, **kwargs):
        sleeps.append(seconds)
        if len(sleeps) >= max_calls:
            raise _Stop
        return None

    monkeypatch.setattr(worker_loop.asyncio, "sleep", _fake_sleep)
    return sleeps


class _BoomSession:
    """SessionLocal whose context entry always fails."""

    async def __aenter__(self):
        raise RuntimeError("simulated statement timeout")

    async def __aexit__(self, *exc):
        return False


class _EmptyScalars:
    def scalars(self):
        return self

    def all(self):
        return []


class _OkSession:
    """Session that yields no rows to delete (i.e. nothing left to prune)."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, *args, **kwargs):
        return _EmptyScalars()

    async def rollback(self):
        return None

    async def commit(self):
        return None


# ── happy path ───────────────────────────────────────────


class TestPruneLoopStartupDelay:
    async def test_startup_delay_precedes_first_cycle(self, monkeypatch):
        sleeps = _patch_sleep(monkeypatch, max_calls=3)
        monkeypatch.setattr(worker_loop, "SessionLocal", lambda: _OkSession())

        with pytest.raises(_Stop):
            await worker_loop.prune_trades_raw_loop()

        # first sleep is the boot grace period, NOT the 24h interval
        assert sleeps[0] == 120.0
        assert sleeps[0] != 86400.0

    async def test_startup_delay_is_configurable(self, monkeypatch):
        monkeypatch.setenv("TRADES_RAW_PRUNE_STARTUP_DELAY_SECONDS", "7")
        sleeps = _patch_sleep(monkeypatch, max_calls=3)
        monkeypatch.setattr(worker_loop, "SessionLocal", lambda: _OkSession())

        with pytest.raises(_Stop):
            await worker_loop.prune_trades_raw_loop()

        assert sleeps[0] == 7.0

    async def test_successful_cycle_then_waits_full_interval(self, monkeypatch):
        sleeps = _patch_sleep(monkeypatch, max_calls=3)
        monkeypatch.setattr(worker_loop, "SessionLocal", lambda: _OkSession())

        with pytest.raises(_Stop):
            await worker_loop.prune_trades_raw_loop()

        # [startup delay, interval, interval, ...]
        assert sleeps[0] == 120.0
        assert sleeps[1] == 86400.0

    async def test_started_log_line_reports_new_knobs(self, monkeypatch, caplog):
        import logging as _logging

        sleeps = _patch_sleep(monkeypatch, max_calls=2)
        monkeypatch.setattr(worker_loop, "SessionLocal", lambda: _OkSession())

        with caplog.at_level(_logging.INFO, logger="unified.worker_loop"):
            with pytest.raises(_Stop):
                await worker_loop.prune_trades_raw_loop()

        joined = " ".join(r.getMessage() for r in caplog.records)
        assert "prune_trades_raw_loop_started" in joined
        assert "startup_delay=" in joined
        assert "retry=" in joined


# ── failure path ─────────────────────────────────────────


class TestPruneLoopFailureBackoff:
    async def test_failure_sleeps_retry_interval_not_full_day(self, monkeypatch):
        sleeps = _patch_sleep(monkeypatch, max_calls=4)
        monkeypatch.setattr(worker_loop, "SessionLocal", _BoomSession)

        with pytest.raises(_Stop):
            await worker_loop.prune_trades_raw_loop()

        assert sleeps[0] == 120.0          # startup grace
        assert sleeps[1] == 300.0          # retry backoff, NOT 86400
        assert 86400.0 not in sleeps

    async def test_retry_interval_is_configurable(self, monkeypatch):
        monkeypatch.setenv("TRADES_RAW_PRUNE_RETRY_SECONDS", "45")
        sleeps = _patch_sleep(monkeypatch, max_calls=3)
        monkeypatch.setattr(worker_loop, "SessionLocal", _BoomSession)

        with pytest.raises(_Stop):
            await worker_loop.prune_trades_raw_loop()

        assert sleeps[1] == 45.0

    async def test_failure_is_logged_with_retry_hint(self, monkeypatch, caplog):
        import logging as _logging

        _patch_sleep(monkeypatch, max_calls=3)
        monkeypatch.setattr(worker_loop, "SessionLocal", _BoomSession)

        with caplog.at_level(_logging.ERROR, logger="unified.worker_loop"):
            with pytest.raises(_Stop):
                await worker_loop.prune_trades_raw_loop()

        joined = " ".join(r.getMessage() for r in caplog.records)
        assert "prune_trades_raw_failed" in joined
        assert "retry_in=" in joined

    async def test_loop_survives_and_keeps_retrying(self, monkeypatch):
        """A persistent failure must not kill the loop (original behaviour kept)."""
        sleeps = _patch_sleep(monkeypatch, max_calls=6)
        monkeypatch.setattr(worker_loop, "SessionLocal", _BoomSession)

        with pytest.raises(_Stop):
            await worker_loop.prune_trades_raw_loop()

        # startup delay + five retries, each 300s -> never the 24h interval
        assert sleeps == [120.0, 300.0, 300.0, 300.0, 300.0, 300.0]
