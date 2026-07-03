import asyncio
import functools

from shared.config import settings


def _stripe():
  try:
    import stripe  # type: ignore
  except Exception as e:
    raise RuntimeError("stripe sdk is required") from e
  if not settings.stripe_secret_key:
    raise RuntimeError("STRIPE_SECRET_KEY is required")
  stripe.api_key = settings.stripe_secret_key
  return stripe


def _create_checkout_session_sync(
  *,
  stripe_price_id: str,
  activation_code: str,
  plan: str,
  user_id: str | None = None,
  customer_email: str | None = None,
) -> str:
  stripe = _stripe()
  metadata = {"activation_code": activation_code, "plan": plan}
  if user_id:
    metadata["user_id"] = user_id
  if not settings.landing_success_url or not settings.landing_cancel_url:
    raise RuntimeError("LANDING_SUCCESS_URL and LANDING_CANCEL_URL are required")
  create_kwargs: dict = {
    "mode": "subscription",
    "line_items": [{"price": stripe_price_id, "quantity": 1}],
    "success_url": settings.landing_success_url,
    "cancel_url": settings.landing_cancel_url,
    "metadata": metadata,
  }
  if customer_email and str(customer_email).strip():
    create_kwargs["customer_email"] = str(customer_email).strip()
  session = stripe.checkout.Session.create(**create_kwargs)
  return str(session.url)


async def create_checkout_session(
  *,
  stripe_price_id: str,
  activation_code: str,
  plan: str,
  user_id: str | None = None,
  customer_email: str | None = None,
) -> str:
  """Async wrapper — offloads the synchronous Stripe HTTP call to a thread pool
  so it does not block the FastAPI event loop (PF-C2)."""
  return await asyncio.get_event_loop().run_in_executor(
    None,
    functools.partial(
      _create_checkout_session_sync,
      stripe_price_id=stripe_price_id,
      activation_code=activation_code,
      plan=plan,
      user_id=user_id,
      customer_email=customer_email,
    ),
  )


def _construct_event_sync(payload: bytes, sig_header: str):
  stripe = _stripe()
  if not settings.stripe_webhook_secret:
    raise RuntimeError("STRIPE_WEBHOOK_SECRET is required")
  return stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=settings.stripe_webhook_secret)


async def construct_event(payload: bytes, sig_header: str):
  """Async wrapper — offloads synchronous Stripe webhook verification (PF-C2)."""
  return await asyncio.get_event_loop().run_in_executor(
    None,
    functools.partial(
      _construct_event_sync,
      payload=payload,
      sig_header=sig_header,
    ),
  )


def _retrieve_subscription_sync(subscription_id: str):
  stripe = _stripe()
  return stripe.Subscription.retrieve(subscription_id)


async def retrieve_subscription(subscription_id: str):
  """Async wrapper — offloads synchronous Stripe API call (PF-C2)."""
  return await asyncio.get_event_loop().run_in_executor(
    None,
    functools.partial(
      _retrieve_subscription_sync,
      subscription_id=subscription_id,
    ),
  )


def _cancel_subscription_sync(subscription_id: str) -> dict:
  """Cancel a Stripe subscription immediately (no proration refund)."""
  stripe = _stripe()
  return stripe.Subscription.cancel(subscription_id)


async def cancel_subscription(subscription_id: str) -> dict:
  """Async wrapper — offloads synchronous Stripe API call (PF-C2)."""
  return await asyncio.get_event_loop().run_in_executor(
    None,
    functools.partial(
      _cancel_subscription_sync,
      subscription_id=subscription_id,
    ),
  )
