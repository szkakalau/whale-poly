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


def create_checkout_session(*, stripe_price_id: str, activation_code: str, plan: str, user_id: str | None = None) -> str:
  stripe = _stripe()
  metadata = {"activation_code": activation_code, "plan": plan}
  if user_id:
    metadata["user_id"] = user_id
  if not settings.landing_success_url or not settings.landing_cancel_url:
    raise RuntimeError("LANDING_SUCCESS_URL and LANDING_CANCEL_URL are required")
  session = stripe.checkout.Session.create(
    mode="subscription",
    line_items=[{"price": stripe_price_id, "quantity": 1}],
    success_url=settings.landing_success_url,
    cancel_url=settings.landing_cancel_url,
    metadata=metadata,
  )
  return str(session.url)


def construct_event(payload: bytes, sig_header: str):
  stripe = _stripe()
  if not settings.stripe_webhook_secret:
    raise RuntimeError("STRIPE_WEBHOOK_SECRET is required")
  return stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=settings.stripe_webhook_secret)


def retrieve_subscription(subscription_id: str):
  stripe = _stripe()
  return stripe.Subscription.retrieve(subscription_id)
