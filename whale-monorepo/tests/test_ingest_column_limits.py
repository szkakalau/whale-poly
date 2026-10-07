"""Ingest column-width guards.

Regression tests for the StringDataRightTruncationError data-loss channel:

Polymarket "grouped" markets concatenate every sub-question into one title with
" AND ", so titles routinely exceed 512 chars. The markets upsert and the
trades_raw insert share a transaction, and `ON CONFLICT DO NOTHING` does NOT
rescue an over-long value — Postgres raises while forming the tuple. Result:
the whole batch (~100 trades) was discarded and the loop kept failing every 31s
until that trade scrolled out of the fetch window.

These tests pin the clipping behaviour that removes the failure mode.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.dialects import postgresql

from services.trade_ingest.polymarket import (
    _MAX_MARKET_ID,
    _MAX_MARKET_TITLE,
    _MAX_OUTCOME,
    _MAX_TRADE_ID,
    _MAX_WALLET,
    _clip,
    ingest_trades,
    parse_trade,
)


# ── Helpers ──────────────────────────────────────────────


def _recent_ts() -> int:
    return int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp() * 1000)


def _grouped_title(n: int = 120) -> str:
    """A realistic Polymarket grouped-market title, far past varchar(512)."""
    return " AND ".join(
        f"Will Team{n} FC win on 2026-09-{i % 28 + 1:02d}?" for i in range(n)
    )


# ── _clip ────────────────────────────────────────────────


class TestClip:
    def test_short_value_untouched(self):
        assert _clip("abc", 512) == "abc"

    def test_exact_limit_untouched(self):
        s = "x" * 512
        assert _clip(s, 512) == s

    def test_over_limit_trimmed(self):
        assert len(_clip("x" * 900, 512)) == 512

    def test_none_passthrough(self):
        assert _clip(None, 512) is None

    def test_non_string_coerced(self):
        assert _clip(12345, 512) == "12345"


# ── parse_trade clipping (protects trades_raw) ───────────


class TestParseTradeClipsToColumnWidths:
    def _raw(self, **over):
        raw = {
            "trade_id": "t1",
            "asset_id": "m1",
            "wallet": "0xA",
            "side": "BUY",
            "outcome": "Yes",
            "amount": 10,
            "price": 0.4,
            "timestamp": _recent_ts(),
            "title": "Small market",
        }
        raw.update(over)
        return raw

    def test_long_grouped_title_is_clipped(self):
        """The exact failure mode: a >512-char grouped title must not survive."""
        title = _grouped_title()
        assert len(title) > 512  # guard: the fixture is actually over the limit

        result = parse_trade(self._raw(title=title))

        assert result is not None
        assert len(result["market_title"]) == _MAX_MARKET_TITLE
        assert result["market_title"] == title[:_MAX_MARKET_TITLE]

    def test_long_market_id_is_clipped(self):
        result = parse_trade(self._raw(asset_id="0x" + "a" * 900))
        assert len(result["market_id"]) == _MAX_MARKET_ID

    def test_long_wallet_is_clipped(self):
        result = parse_trade(self._raw(wallet="0x" + "b" * 900))
        assert len(result["wallet"]) == _MAX_WALLET

    def test_long_outcome_is_clipped(self):
        result = parse_trade(self._raw(outcome="o" * 400))
        assert len(result["outcome"]) == _MAX_OUTCOME

    def test_long_trade_id_is_clipped(self):
        result = parse_trade(self._raw(trade_id="t" * 400))
        assert len(result["trade_id"]) == _MAX_TRADE_ID

    def test_all_string_fields_respect_declared_widths(self):
        """Belt-and-braces: nothing returned exceeds its destination column."""
        result = parse_trade(
            self._raw(
                trade_id="t" * 400,
                asset_id="0x" + "a" * 900,
                wallet="0x" + "b" * 900,
                outcome="o" * 400,
                title=_grouped_title(),
            )
        )
        assert result is not None
        assert len(result["trade_id"]) <= _MAX_TRADE_ID
        assert len(result["market_id"]) <= _MAX_MARKET_ID
        assert len(result["wallet"]) <= _MAX_WALLET
        assert len(result["outcome"]) <= _MAX_OUTCOME
        assert len(result["market_title"]) <= _MAX_MARKET_TITLE

    def test_normal_trade_unchanged(self):
        """No false positives: ordinary data must pass through byte-identical."""
        result = parse_trade(self._raw())
        assert result["market_title"] == "Small market"
        assert result["trade_id"] == "t1"
        assert result["side"] == "buy"
        # 0xA -> normalized lowercase
        assert result["wallet"] == "0xa"

    def test_none_title_stays_none(self):
        """markets.title is NOT NULL — a missing title must not become ""."""
        result = parse_trade(self._raw(title=None))
        assert result is not None
        assert result["market_title"] is None


# ── ingest_trades: the markets upsert itself ─────────────


class _EmptyResult:
    def scalars(self):
        return self

    def all(self):
        return []


class _CapturingSession:
    """Minimal AsyncSession stand-in that records executed statements."""

    def __init__(self):
        self.stmts = []

    async def execute(self, stmt, *args, **kwargs):
        self.stmts.append(stmt)
        return _EmptyResult()


class TestIngestTradesMarketUpsertClipping:
    async def _run(self, raw_trades):
        session = _CapturingSession()
        with patch(
            "services.trade_ingest.polymarket.fetch_trades",
            new=AsyncMock(return_value=raw_trades),
        ):
            await ingest_trades(session)
        return session

    async def test_market_upsert_values_within_column_widths(self):
        """The INSERT INTO markets that used to raise must carry only legal values."""
        long_title = _grouped_title()
        session = await self._run(
            [
                {
                    "trade_id": "t1",
                    "asset_id": "m1",
                    "wallet": "0xA",
                    "side": "BUY",
                    "outcome": "Yes",
                    "amount": 10,
                    "price": 0.4,
                    "timestamp": _recent_ts(),
                    "title": long_title,
                }
            ]
        )

        assert session.stmts, "expected at least the markets upsert to be executed"

        params = session.stmts[0].compile(
            dialect=postgresql.dialect()
        ).params
        strings = [v for v in params.values() if isinstance(v, str)]
        assert strings, "expected string bind params on the markets insert"
        assert max(len(s) for s in strings) <= _MAX_MARKET_TITLE
        # and the title really was the long one, clipped
        assert long_title[:_MAX_MARKET_TITLE] in strings

    async def test_two_markets_both_clipped(self):
        session = await self._run(
            [
                {
                    "trade_id": f"t{i}",
                    "asset_id": f"m{i}",
                    "wallet": "0xA",
                    "side": "BUY",
                    "outcome": "Yes",
                    "amount": 10,
                    "price": 0.4,
                    "timestamp": _recent_ts(),
                    "title": f"{_grouped_title()}#{i}",
                }
                for i in (0, 1)
            ]
        )
        params = session.stmts[0].compile(dialect=postgresql.dialect()).params
        strings = [v for v in params.values() if isinstance(v, str)]
        assert max(len(s) for s in strings) <= _MAX_MARKET_TITLE

    async def test_no_market_upsert_when_no_rows(self):
        session = await self._run([])
        assert session.stmts == []
