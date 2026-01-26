import asyncio
import hashlib
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from services.payment.stripe_service import construct_event, create_checkout_session, retrieve_subscription
from shared.config import settings
from shared.db import SessionLocal, get_session
from shared.logging import configure_logging
from shared.models import ActivationCode, Plan, StripeEvent, Subscription


configure_logging(settings.log_level)
logger = logging.getLogger("payment.api")


class CheckoutIn(BaseModel):
  telegram_activation_code: str
  plan: str


def _sub_id(code: str, plan: str) -> str:
  return hashlib.sha1(f"sub:{code}:{plan}".encode("utf-8")).hexdigest()[:64]


def _period_end(plan_name: str) -> datetime:
  now = datetime.now(timezone.utc)
  p = (plan_name or "").lower()
  if p == "yearly":
    return now + timedelta(days=365)
  return now + timedelta(days=30)


async def _activate_subscription(session: AsyncSession, *, code: str, plan: Plan) -> str:
  ac = (await session.execute(select(ActivationCode).where(ActivationCode.code == code))).scalars().first()
  if not ac or ac.used:
    raise HTTPException(status_code=404, detail="activation code not found")

  telegram_id = ac.telegram_id
  now = datetime.now(timezone.utc)
  current_period_end = _period_end(plan.name)

  sub_id = _sub_id(code, plan.name)
  stripe_subscription_id = f"mock_{sub_id}"
  stripe_customer_id = f"mock_{telegram_id}"

  await session.execute(
    insert(Subscription)
    .values(
      id=sub_id,
      telegram_id=telegram_id,
      stripe_customer_id=stripe_customer_id,
      stripe_subscription_id=stripe_subscription_id,
      status="active",
      current_period_end=current_period_end,
    )
    .on_conflict_do_update(
      index_elements=[Subscription.stripe_subscription_id],
      set_={
        "status": "active",
        "current_period_end": current_period_end,
        "telegram_id": telegram_id,
        "stripe_customer_id": stripe_customer_id,
      },
    )
  )
  await session.execute(update(ActivationCode).where(ActivationCode.code == code).values(used=True))
  await session.commit()

  return settings.landing_success_url or "/"


async def _mark_expired_forever(stop: asyncio.Event) -> None:
  while not stop.is_set():
    now = datetime.now(timezone.utc)
    async with SessionLocal() as session:
      await session.execute(
        update(Subscription)
        .where(Subscription.status == "active")
        .where(Subscription.current_period_end < now)
        .values(status="expired")
      )
      await session.commit()
    try:
      await asyncio.wait_for(stop.wait(), timeout=3600)
    except asyncio.TimeoutError:
      continue


@asynccontextmanager
async def lifespan(_: FastAPI):
  stop = asyncio.Event()
  task = asyncio.create_task(_mark_expired_forever(stop), name="expire_loop")
  try:
    yield
  finally:
    stop.set()
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)


app = FastAPI(title="payment", lifespan=lifespan)


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.get("/plans")
async def plans(session: AsyncSession = Depends(get_session)):
  rows = (await session.execute(select(Plan).order_by(Plan.price_usd.asc()))).scalars().all()
  return [{"id": p.id, "name": p.name, "price_usd": p.price_usd, "stripe_price_id": p.stripe_price_id} for p in rows]


@app.post("/checkout")
async def checkout(payload: CheckoutIn, session: AsyncSession = Depends(get_session)):
  code = payload.telegram_activation_code.strip().upper()
  plan_name = payload.plan.strip().lower()
  plan = (await session.execute(select(Plan).where(Plan.name == plan_name))).scalars().first()
  if not plan:
    raise HTTPException(status_code=404, detail="plan not found")

  if settings.payment_mode == "mock" or not settings.stripe_secret_key:
    url = await _activate_subscription(session, code=code, plan=plan)
    return {"checkout_url": url, "mode": "mock"}

  url = create_checkout_session(stripe_price_id=plan.stripe_price_id, activation_code=code, plan=plan.name)
  return {"checkout_url": url, "mode": "stripe"}


@app.post("/webhook")
async def webhook(request: Request, stripe_signature: str | None = Header(None, alias="Stripe-Signature")):
  if settings.payment_mode == "mock":
    return {"ok": True, "mode": "mock"}
  if not stripe_signature:
    raise HTTPException(status_code=400, detail="missing signature")
  payload = await request.body()
  try:
    event = construct_event(payload, stripe_signature)
  except Exception:
    logger.exception("signature_verification_failed")
    raise HTTPException(status_code=400, detail="invalid signature")

  event_id = str(event.get("id") or "")
  event_type = str(event.get("type") or "")
  if not event_id or not event_type:
    raise HTTPException(status_code=400, detail="invalid event")

  async with SessionLocal() as session:
    processed = await session.execute(
      insert(StripeEvent).values(id=event_id, event_type=event_type).on_conflict_do_nothing(index_elements=[StripeEvent.id])
    )
    if processed.rowcount != 1:
      await session.commit()
      return {"ok": True, "duplicate": True}

    if event_type == "checkout.session.completed":
      obj = event["data"]["object"]
      metadata = obj.get("metadata") or {}
      activation_code = str(metadata.get("activation_code") or "").upper()
      if activation_code:
        ac = (await session.execute(select(ActivationCode).where(ActivationCode.code == activation_code))).scalars().first()
        if ac and not ac.used:
          telegram_id = ac.telegram_id
          stripe_customer_id = str(obj.get("customer") or "")
          stripe_subscription_id = str(obj.get("subscription") or "")
          if stripe_customer_id and stripe_subscription_id:
            sub = retrieve_subscription(stripe_subscription_id)
            cpe = int(sub.get("current_period_end") or 0)
            current_period_end = datetime.fromtimestamp(cpe, tz=timezone.utc) if cpe else datetime.now(timezone.utc)
            await session.execute(
              insert(Subscription)
              .values(
                id=event_id[:64],
                telegram_id=telegram_id,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id,
                status="active",
                current_period_end=current_period_end,
              )
              .on_conflict_do_update(
                index_elements=[Subscription.stripe_subscription_id],
                set_={"status": "active", "current_period_end": current_period_end, "telegram_id": telegram_id, "stripe_customer_id": stripe_customer_id},
              )
            )
            await session.execute(update(ActivationCode).where(ActivationCode.code == activation_code).values(used=True))

    if event_type in ("customer.subscription.deleted", "customer.subscription.canceled"):
      obj = event["data"]["object"]
      sid = str(obj.get("id") or "")
      if sid:
        await session.execute(update(Subscription).where(Subscription.stripe_subscription_id == sid).values(status="canceled"))

    await session.commit()
  return {"ok": True}
