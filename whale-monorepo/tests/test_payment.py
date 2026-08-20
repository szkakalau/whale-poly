"""
Tests for Payment module — Stripe checkout, webhook verification, subscription management.

TC-C1, TC-H5: Payment module and Stripe webhook tests.
Uses unittest.mock to patch the synchronous Stripe internals.
All Stripe calls use async wrappers with functools.partial (PF-C2 + keyword-arg fix).
P1/P2: checkout fail-fast guards (missing Stripe key, mock against prod DB)
and activation-code minting for logged-in web users.
"""
import re

import pytest
from fastapi import HTTPException
from unittest.mock import patch, MagicMock, AsyncMock

from services.payment.stripe_service import (
    create_checkout_session,
    construct_event,
    retrieve_subscription,
    cancel_subscription,
)
from services.payment.api import CheckoutIn, checkout as checkout_endpoint, health as health_endpoint


def _mock_stripe_module():
    """Return a MagicMock that mimics the stripe SDK module."""
    stripe = MagicMock()
    stripe.api_key = None
    return stripe


class _FakeExec:
    """Fake session.execute result with .scalars().first()."""

    def __init__(self, item):
        self._item = item

    def scalars(self):
        return self


    def first(self):
        return self._item


class _FakeSessionCtx:
    """Fake async context manager for SessionLocal()."""

    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *args):
        return False


def _checkout_payload(**overrides):
    defaults = {
        "telegram_activation_code": "ABCD1234",
        "plan": "pro",
        "user_id": None,
        "customer_email": None,
        "telegram_id": None,
    }
    defaults.update(overrides)
    return CheckoutIn(**defaults)


def _mock_settings(mode="stripe", secret_key="sk_test", database_url="postgresql://localhost/db"):
    s = MagicMock()
    s.payment_mode = mode
    s.stripe_secret_key = secret_key
    s.database_url = database_url
    return s


# ── create_checkout_session ────────────────────────────────


@pytest.mark.asyncio
async def test_create_checkout_session_returns_url():
    """Valid params → returns Stripe Checkout URL."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.checkout.Session.create.return_value.url = "https://checkout.stripe.com/c/test"
        mock_stripe_fn.return_value = stripe_mod

        url = await create_checkout_session(
            stripe_price_id="price_test123",
            activation_code="CODE001",
            plan="pro",
            customer_email="test@example.com",
        )

        assert url == "https://checkout.stripe.com/c/test"
        stripe_mod.checkout.Session.create.assert_called_once()
        call_kwargs = stripe_mod.checkout.Session.create.call_args[1]
        assert call_kwargs["mode"] == "subscription"
        assert call_kwargs["customer_email"] == "test@example.com"
        assert call_kwargs["metadata"]["activation_code"] == "CODE001"


@pytest.mark.asyncio
async def test_create_checkout_session_includes_user_id():
    """User ID is included in metadata when provided."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.checkout.Session.create.return_value.url = "https://checkout.stripe.com/c/u"
        mock_stripe_fn.return_value = stripe_mod

        await create_checkout_session(
            stripe_price_id="price_x",
            activation_code="CODE",
            plan="elite",
            user_id="user_abc",
        )

        metadata = stripe_mod.checkout.Session.create.call_args[1]["metadata"]
        assert metadata["user_id"] == "user_abc"


@pytest.mark.asyncio
async def test_create_checkout_session_no_email():
    """No customer_email → not included in kwargs."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.checkout.Session.create.return_value.url = "https://checkout.stripe.com/c/nomail"
        mock_stripe_fn.return_value = stripe_mod

        await create_checkout_session(
            stripe_price_id="price_x",
            activation_code="CODE",
            plan="pro",
        )

        call_kwargs = stripe_mod.checkout.Session.create.call_args[1]
        assert "customer_email" not in call_kwargs


@pytest.mark.asyncio
async def test_create_checkout_session_stripe_unavailable():
    """Stripe import failure → RuntimeError."""
    with patch("services.payment.stripe_service._stripe", side_effect=RuntimeError("stripe sdk is required")):
        with pytest.raises(RuntimeError, match="stripe sdk is required"):
            await create_checkout_session(
                stripe_price_id="price_x",
                activation_code="CODE",
                plan="pro",
            )


# ── construct_event (webhook signature verification) ────────


@pytest.mark.asyncio
async def test_construct_event_valid_signature():
    """Valid Stripe-Signature header → returns event dict."""
    with (
        patch("services.payment.stripe_service._stripe") as mock_stripe_fn,
        patch("services.payment.stripe_service.settings") as mock_settings,
    ):
        mock_settings.stripe_webhook_secret = "whsec_test"
        mock_settings.stripe_secret_key = "sk_test"
        stripe_mod = _mock_stripe_module()
        expected = {"type": "checkout.session.completed", "data": {"object": {"id": "cs_test"}}}
        stripe_mod.Webhook.construct_event.return_value = expected
        mock_stripe_fn.return_value = stripe_mod

        event = await construct_event(
            payload=b'{"type":"checkout.session.completed"}',
            sig_header="t=123,v1=sig",
        )

        assert event == expected
        stripe_mod.Webhook.construct_event.assert_called_once()


@pytest.mark.asyncio
async def test_construct_event_invalid_signature():
    """Invalid signature → ValueError from Stripe SDK."""
    with (
        patch("services.payment.stripe_service._stripe") as mock_stripe_fn,
        patch("services.payment.stripe_service.settings") as mock_settings,
    ):
        mock_settings.stripe_webhook_secret = "whsec_test"
        mock_settings.stripe_secret_key = "sk_test"
        stripe_mod = _mock_stripe_module()
        stripe_mod.Webhook.construct_event.side_effect = ValueError("Invalid signature")
        mock_stripe_fn.return_value = stripe_mod

        with pytest.raises(ValueError, match="Invalid signature"):
            await construct_event(payload=b"bad", sig_header="t=123,v1=bad_sig")


@pytest.mark.asyncio
async def test_construct_event_missing_webhook_secret():
    """Missing STRIPE_WEBHOOK_SECRET → RuntimeError."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        mock_stripe_fn.return_value = stripe_mod
        with patch("services.payment.stripe_service.settings") as mock_settings:
            mock_settings.stripe_webhook_secret = None
            mock_settings.stripe_secret_key = "sk_test"

            with pytest.raises(RuntimeError, match="STRIPE_WEBHOOK_SECRET"):
                await construct_event(payload=b"{}", sig_header="t=123,v1=sig")


# ── retrieve_subscription ───────────────────────────────────


@pytest.mark.asyncio
async def test_retrieve_subscription_active():
    """Valid subscription ID → returns subscription dict."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.Subscription.retrieve.return_value = {
            "id": "sub_test123",
            "status": "active",
            "current_period_end": 1700000000,
        }
        mock_stripe_fn.return_value = stripe_mod

        sub = await retrieve_subscription("sub_test123")
        assert sub["id"] == "sub_test123"
        assert sub["status"] == "active"


@pytest.mark.asyncio
async def test_retrieve_subscription_not_found():
    """Non-existent subscription → Stripe error."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.Subscription.retrieve.side_effect = Exception("No such subscription: sub_nonexistent")
        mock_stripe_fn.return_value = stripe_mod

        with pytest.raises(Exception, match="No such subscription"):
            await retrieve_subscription("sub_nonexistent")


# ── cancel_subscription ─────────────────────────────────────


@pytest.mark.asyncio
async def test_cancel_subscription_success():
    """Active subscription → cancelled successfully."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.Subscription.cancel.return_value = {"id": "sub_to_cancel", "status": "canceled"}
        mock_stripe_fn.return_value = stripe_mod

        result = await cancel_subscription("sub_to_cancel")
        assert result["status"] == "canceled"


@pytest.mark.asyncio
async def test_cancel_subscription_already_canceled():
    """Already canceled → idempotent (same result)."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.Subscription.cancel.return_value = {"id": "sub_already", "status": "canceled"}
        mock_stripe_fn.return_value = stripe_mod

        result = await cancel_subscription("sub_already")
        assert result["status"] == "canceled"


@pytest.mark.asyncio
async def test_cancel_subscription_stripe_error():
    """Stripe API error → propagates."""
    with patch("services.payment.stripe_service._stripe") as mock_stripe_fn:
        stripe_mod = _mock_stripe_module()
        stripe_mod.Subscription.cancel.side_effect = Exception("Stripe API error")
        mock_stripe_fn.return_value = stripe_mod

        with pytest.raises(Exception, match="Stripe API error"):
            await cancel_subscription("sub_error")


# ═══════════════════════════════════════════════════════════
# P1: checkout fail-fast guards
# ═══════════════════════════════════════════════════════════


def _plan_exec():
    plan = MagicMock()
    plan.name = "pro"
    plan.stripe_price_id = "price_x"
    return _FakeExec(plan)


@pytest.mark.asyncio
async def test_checkout_stripe_mode_missing_key_raises_500():
    """P1: stripe mode without a secret key must fail loud, never free-activate."""
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_plan_exec()])
    with (
        patch("services.payment.api.settings", _mock_settings(mode="stripe", secret_key="")),
        patch("services.payment.api._activate_subscription", new=AsyncMock()) as mock_activate,
        patch("services.payment.api.create_checkout_session", new=AsyncMock()) as mock_create,
    ):
        with pytest.raises(HTTPException) as exc:
            await checkout_endpoint(_checkout_payload(), session)
        assert exc.value.status_code == 500
        assert "STRIPE_SECRET_KEY" in exc.value.detail
        mock_activate.assert_not_called()
        mock_create.assert_not_called()


@pytest.mark.asyncio
async def test_checkout_stripe_mode_with_key_creates_session():
    """stripe mode with a key → real Stripe session."""
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_plan_exec()])
    with (
        patch("services.payment.api.settings", _mock_settings()),
        patch("services.payment.api.create_checkout_session", new=AsyncMock(return_value="https://checkout.stripe.com/c/t")) as mock_create,
    ):
        result = await checkout_endpoint(_checkout_payload(), session)
        assert result == {"checkout_url": "https://checkout.stripe.com/c/t", "mode": "stripe"}
        assert mock_create.call_args.kwargs["activation_code"] == "ABCD1234"
        assert mock_create.call_args.kwargs["stripe_price_id"] == "price_x"


@pytest.mark.asyncio
async def test_checkout_mock_mode_against_prod_db_raises_500():
    """P3: mock activation against a production database must be refused."""
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_plan_exec()])
    with (
        patch("services.payment.api.settings", _mock_settings(
            mode="mock",
            secret_key="",
            database_url="postgresql+asyncpg://whale:xxx@dpg-test.oregon-postgres.render.com/whale",
        )),
        patch("services.payment.api._activate_subscription", new=AsyncMock()) as mock_activate,
    ):
        with pytest.raises(HTTPException) as exc:
            await checkout_endpoint(_checkout_payload(), session)
        assert exc.value.status_code == 500
        assert "production database" in exc.value.detail
        mock_activate.assert_not_called()


@pytest.mark.asyncio
async def test_checkout_mock_mode_local_activates():
    """mock mode against a local DB still activates (legit dev flow)."""
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_plan_exec()])
    with (
        patch("services.payment.api.settings", _mock_settings(mode="mock", secret_key="")),
        patch("services.payment.api._activate_subscription", new=AsyncMock(return_value="http://ok")) as mock_activate,
    ):
        result = await checkout_endpoint(_checkout_payload(), session)
        assert result == {"checkout_url": "http://ok", "mode": "mock"}
        mock_activate.assert_called_once()


@pytest.mark.asyncio
async def test_checkout_invalid_telegram_id_raises_400():
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_plan_exec()])
    with patch("services.payment.api.settings", _mock_settings()):
        with pytest.raises(HTTPException) as exc:
            await checkout_endpoint(_checkout_payload(telegram_activation_code="", telegram_id="not-a-tg-id"), session)
        assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_checkout_no_code_no_telegram_id_raises_400():
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_plan_exec()])
    with patch("services.payment.api.settings", _mock_settings()):
        with pytest.raises(HTTPException) as exc:
            await checkout_endpoint(_checkout_payload(telegram_activation_code=""), session)
        assert exc.value.status_code == 400


# ═══════════════════════════════════════════════════════════
# P2: activation-code minting for logged-in web users
# ═══════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_checkout_mints_activation_code_for_telegram_id():
    """No code + valid telegram_id → an 8-char code is minted and used."""
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_plan_exec(), _FakeExec(None)])  # plan, code collision lookup
    session.add = MagicMock()
    session.commit = AsyncMock()
    with (
        patch("services.payment.api.settings", _mock_settings()),
        patch("services.payment.api.create_checkout_session", new=AsyncMock(return_value="https://checkout.stripe.com/c/m")) as mock_create,
    ):
        result = await checkout_endpoint(
            _checkout_payload(telegram_activation_code="", telegram_id="8124447699"), session
        )
        assert result["mode"] == "stripe"
        minted = mock_create.call_args.kwargs["activation_code"]
        assert re.fullmatch(r"[A-Z0-9]{8}", minted), f"expected 8-char code, got {minted!r}"
        session.add.assert_called_once()
        session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_health_reports_payment_config():
    session = MagicMock()
    session.execute = AsyncMock()
    with (
        patch("services.payment.api.settings", _mock_settings()),
        patch("services.payment.api.SessionLocal", return_value=_FakeSessionCtx(session)),
    ):
        result = await health_endpoint()
        assert result["status"] == "ok"
        assert result["payment_config"] == "stripe_ok"
