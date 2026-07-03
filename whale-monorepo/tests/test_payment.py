"""
Tests for Payment module — Stripe checkout, webhook verification, subscription management.

TC-C1, TC-H5: Payment module and Stripe webhook tests.
Uses unittest.mock to patch the synchronous Stripe internals.
All Stripe calls use async wrappers with functools.partial (PF-C2 + keyword-arg fix).
"""
import pytest
from unittest.mock import patch, MagicMock

from services.payment.stripe_service import (
    create_checkout_session,
    construct_event,
    retrieve_subscription,
    cancel_subscription,
)


def _mock_stripe_module():
    """Return a MagicMock that mimics the stripe SDK module."""
    stripe = MagicMock()
    stripe.api_key = None
    return stripe


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
