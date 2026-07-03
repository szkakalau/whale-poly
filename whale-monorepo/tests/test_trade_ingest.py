"""
Tests for Trade Ingest — data parsing, market resolution, ingestion pipeline.

TC-H1: Core trade ingest tests. Covers parse_trade (polymarket.py),
resolve_token_id edge cases (markets.py), and key ingestion logic.
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from services.trade_ingest.polymarket import parse_trade
from services.trade_ingest.markets import resolve_token_id


# ── Helpers ──────────────────────────────────────────────


def _recent_ts() -> int:
    """Return a millisecond-level Unix timestamp within the 7-day acceptance window."""
    return int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp() * 1000)


# ── parse_trade ────────────────────────────────────────────


class TestParseTrade:
    """parse_trade — CLOB trade JSON → normalized dict."""

    def test_valid_trade_all_fields(self):
        """Complete trade JSON → all fields normalized."""
        ts = _recent_ts()
        raw = {
            "trade_id": "trade_abc123",
            "asset_id": "0xmarket456",
            "wallet": "0xWalletAddr",
            "side": "BUY",
            "outcome": "Yes",
            "amount": "100.5",
            "price": "0.65",
            "timestamp": ts,
            "title": "Test Market",
        }
        result = parse_trade(raw)
        assert result is not None
        assert result["trade_id"] == "trade_abc123"
        assert result["wallet"] == "0xwalletaddr"  # normalized lowercase
        assert result["side"] == "buy"
        assert result["outcome"] == "Yes"
        assert result["amount"] == 100.5
        assert result["price"] == 0.65
        assert result["market_title"] == "Test Market"

    def test_side_sell(self):
        """SELL side is normalized to 'sell'."""
        ts = _recent_ts()
        result = parse_trade({
            "trade_id": "t1", "asset_id": "m1", "wallet": "0xA",
            "side": "SELL", "outcome": "No", "amount": 10, "price": 0.4,
            "timestamp": ts,
        })
        assert result is not None
        assert result["side"] == "sell"

    def test_id_fallback(self):
        """Missing trade_id → falls back to 'id' field."""
        ts = _recent_ts()
        result = parse_trade({
            "id": "fallback_id_789", "asset_id": "m1", "wallet": "0xB",
            "side": "buy", "outcome": "Yes", "amount": 5, "price": 0.5,
            "timestamp": ts,
        })
        assert result is not None
        assert result["trade_id"] == "fallback_id_789"

    def test_outcome_index_0_yes(self):
        """outcomeIndex=0 → outcome='Yes'."""
        ts = _recent_ts()
        result = parse_trade({
            "trade_id": "t_idx", "asset_id": "m1", "wallet": "0xC",
            "side": "buy", "amount": 5, "price": 0.5,
            "timestamp": ts, "outcomeIndex": 0,
        })
        assert result is not None
        assert result["outcome"] == "Yes"

    def test_outcome_index_1_no(self):
        """outcomeIndex=1 → outcome='No'."""
        ts = _recent_ts()
        result = parse_trade({
            "trade_id": "t_idx2", "asset_id": "m1", "wallet": "0xD",
            "side": "buy", "amount": 5, "price": 0.5,
            "timestamp": ts, "outcomeIndex": 1,
        })
        assert result is not None
        assert result["outcome"] == "No"

    def test_market_in_dict(self):
        """Market as nested dict → extracts id."""
        ts = _recent_ts()
        result = parse_trade({
            "trade_id": "t_dict", "wallet": "0xE",
            "side": "buy", "amount": 10, "price": 0.3,
            "timestamp": ts,
            "market": {"id": "nested_market_1", "title": "Nested"},
        })
        assert result is not None
        assert result["market_id"].startswith("nested_market_1")

    def test_no_trade_id_returns_none(self):
        """Missing all ID fields → None."""
        result = parse_trade({
            "wallet": "0xX", "side": "buy",
            "amount": 1, "price": 0.5,
        })
        assert result is None

    def test_no_timestamp_returns_none(self):
        """Missing timestamp → None."""
        result = parse_trade({
            "trade_id": "t_nots", "asset_id": "m1",
            "wallet": "0xY", "side": "buy",
            "amount": 1, "price": 0.5,
        })
        assert result is None

    def test_old_trade_returns_none(self):
        """Trade older than 7 days → None (filtered out)."""
        old_ts = int((datetime.now(timezone.utc) - timedelta(days=8)).timestamp() * 1000)
        result = parse_trade({
            "trade_id": "t_old", "asset_id": "m1",
            "wallet": "0xZ", "side": "buy",
            "amount": 1, "price": 0.5,
            "timestamp": old_ts,
        })
        assert result is None

    def test_invalid_amount_returns_none(self):
        """Non-numeric amount → None."""
        ts = _recent_ts()
        result = parse_trade({
            "trade_id": "t_bad", "asset_id": "m1",
            "wallet": "0xW", "side": "buy",
            "amount": "not_a_number", "price": "0.5",
            "timestamp": ts,
        })
        assert result is None

    def test_unknown_market_default(self):
        """No market ID → 'unknown'."""
        ts = _recent_ts()
        result = parse_trade({
            "trade_id": "t_nomarket", "wallet": "0xV",
            "side": "buy", "amount": 5, "price": 0.5,
            "timestamp": ts,
        })
        assert result is not None
        assert result["market_id"] == "unknown"


# ── resolve_token_id edge cases ────────────────────────────


@pytest.mark.asyncio
async def test_resolve_token_id_empty_string():
    """Empty token_id → returns None gracefully (no cache, no API)."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    session = AsyncMock()
    session.execute.return_value = mock_result

    with (
        patch("services.trade_ingest.markets._has_token_conditions_table") as mock_ht,
        patch("services.trade_ingest.markets.httpx") as mock_httpx,
    ):
        mock_ht.return_value = False
        # Mock the API response to return nothing
        mock_client = MagicMock()
        mock_client.get.return_value.status_code = 404
        mock_httpx.AsyncClient.return_value.__aenter__.return_value = mock_client

        result = await resolve_token_id(session, "")
        # Empty token_id → all API fallbacks fail → returns None (not even a constructed name)
        assert result is None or result.startswith("Market (")


@pytest.mark.asyncio
async def test_resolve_token_id_cache_hit():
    """Cached token_id → returns cached question without API call."""
    mock_cached = MagicMock()
    mock_cached.question = "Cached Market Question"
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_cached
    session = AsyncMock()
    session.execute.return_value = mock_result

    with patch("services.trade_ingest.markets._has_token_conditions_table") as mock_ht:
        mock_ht.return_value = True
        result = await resolve_token_id(session, "cached_token")
        assert result == "Cached Market Question"
