import asyncio
import hashlib
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from services.payment.stripe_service import construct_event, create_checkout_session, retrieve_subscription
from shared.config import settings
from shared.db import SessionLocal, get_session
from shared.logging import configure_logging
from shared.models import ActivationCode, Plan, StripeEvent, Subscription, User

configure_logging(settings.log_level)
logger = logging.getLogger("payment.api")



class CheckoutIn(BaseModel):
  telegram_activation_code: str
  plan: str
  user_id: str | None = None
  
class PlanUpsertItem(BaseModel):
  name: str
  price_usd: int
  stripe_price_id: str
  
class PlansUpsertIn(BaseModel):
  items: list[PlanUpsertItem]


def _sub_id(code: str, plan: str) -> str:
  return hashlib.sha1(f"sub:{code}:{plan}".encode("utf-8")).hexdigest()[:64]


def _period_end(plan_name: str) -> datetime:
  now = datetime.now(timezone.utc)
  p = (plan_name or "").lower()
  if "yearly" in p:
    return now + timedelta(days=365)
  return now + timedelta(days=30)


async def _activate_subscription(session: AsyncSession, *, code: str, plan: Plan, user_id: str | None) -> str:
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
      plan=plan.name,
      current_period_end=current_period_end,
    )
    .on_conflict_do_update(
      index_elements=[Subscription.stripe_subscription_id],
      set_={
        "status": "active",
        "plan": plan.name,
        "current_period_end": current_period_end,
        "telegram_id": telegram_id,
        "stripe_customer_id": stripe_customer_id,
      },
    )
  )
  if user_id:
    await session.execute(
      update(User)
      .where(User.id == user_id)
      .values(
        telegram_id=telegram_id,
        plan=plan.name.upper(),
        plan_expire_at=current_period_end
      )
    )
  await session.execute(update(ActivationCode).where(ActivationCode.code == code).values(used=True))
  await session.commit()

  return settings.landing_success_url or "/"


async def _mark_expired_forever(stop: asyncio.Event) -> None:
  while not stop.is_set():
    now = datetime.now(timezone.utc)
    async with SessionLocal() as session:
      # Find expiring subscriptions
      expiring = (await session.execute(
        select(Subscription.telegram_id)
        .where(Subscription.status == "active")
        .where(Subscription.current_period_end < now)
      )).scalars().all()

      if expiring:
        # Update subscription status
        await session.execute(
          update(Subscription)
          .where(Subscription.status == "active")
          .where(Subscription.current_period_end < now)
          .values(status="expired")
        )
        # Revert users to FREE plan
        await session.execute(
          update(User)
          .where(User.telegram_id.in_(expiring))
          .values(plan="FREE", plan_expire_at=None)
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


def _require_admin(x_admin_token: str | None) -> None:
  if not settings.admin_token or not x_admin_token or x_admin_token != settings.admin_token:
    raise HTTPException(status_code=404, detail="not_found")


@app.get("/")
async def root():
  return {"status": "ok"}


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.get("/healthz")
async def healthz():
  return {"status": "ok"}


@app.get("/plans")
async def plans(session: AsyncSession = Depends(get_session)):
  rows = (await session.execute(select(Plan).order_by(Plan.price_usd.asc()))).scalars().all()
  return [{"id": p.id, "name": p.name, "price_usd": p.price_usd, "stripe_price_id": p.stripe_price_id} for p in rows]

@app.post("/admin/plans/upsert")
async def admin_plans_upsert(payload: PlansUpsertIn, x_admin_token: str | None = Header(None, alias="X-Admin-Token"), session: AsyncSession = Depends(get_session)):
  _require_admin(x_admin_token)
  count = 0
  for it in payload.items:
    name = (it.name or "").strip().lower()
    if not name or not it.stripe_price_id or not isinstance(it.price_usd, int):
      continue
    if "institutional" in name:
      name = name.replace("institutional", "elite")
    plan_id = f"{name}"[:64]
    await session.execute(
      insert(Plan)
      .values(id=plan_id, name=name, price_usd=int(it.price_usd), stripe_price_id=str(it.stripe_price_id))
      .on_conflict_do_update(
        index_elements=[Plan.name],
        set_={"price_usd": int(it.price_usd), "stripe_price_id": str(it.stripe_price_id)}
      )
    )
    count += 1
  await session.commit()
  return {"upserted": count}

@app.get("/admin/subscriptions/stats")
async def subscription_stats(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
  _require_admin(x_admin_token)
  now = datetime.now(timezone.utc)
  async with SessionLocal() as session:
    total = (
      await session.execute(select(func.count()).select_from(Subscription))
    ).scalar_one()
    active_now = (
      await session.execute(
        select(func.count())
        .select_from(Subscription)
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > now)
      )
    ).scalar_one()
    by_status = (
      await session.execute(
        select(Subscription.status, func.count())
        .group_by(Subscription.status)
        .order_by(func.count().desc())
      )
    ).all()
    distinct_tg = (
      await session.execute(
        select(func.count(func.distinct(Subscription.telegram_id))).select_from(Subscription)
      )
    ).scalar_one()
    users_total = (await session.execute(select(func.count()).select_from(User))).scalar_one()
    users_with_tg = (
      await session.execute(select(func.count()).select_from(User).where(User.telegram_id.is_not(None)))
    ).scalar_one()
    users_test_like = (
      await session.execute(select(func.count()).select_from(User).where(User.email.ilike("%test%")))
    ).scalar_one()
    recent_active = (
      await session.execute(
        select(Subscription.telegram_id, Subscription.current_period_end, Subscription.status)
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > now)
        .order_by(Subscription.current_period_end.desc())
        .limit(20)
      )
    ).all()

  recent_active_redacted = [
    {
      "telegram_hash": hashlib.sha1(f"admin:{tid}".encode("utf-8")).hexdigest()[:10],
      "status": status,
      "current_period_end": dt.isoformat() if dt else None,
    }
    for (tid, dt, status) in recent_active
  ]

  return {
    "subscriptions_total": total,
    "subscriptions_active_now": active_now,
    "subscriptions_distinct_telegram_ids": distinct_tg,
    "subscriptions_by_status": [{"status": s, "count": int(c)} for (s, c) in by_status],
    "users_total": users_total,
    "users_with_telegram_id": users_with_tg,
    "users_email_like_test": users_test_like,
    "recent_active_subscriptions": recent_active_redacted,
  }


@app.get("/admin/subscriptions/list")
async def subscription_list(
  active_only: bool = True,
  limit: int = 200,
  x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
  _require_admin(x_admin_token)
  now = datetime.now(timezone.utc)
  safe_limit = max(1, min(int(limit), 2000))

  async with SessionLocal() as session:
    query = (
      select(
        Subscription.telegram_id,
        Subscription.status,
        Subscription.current_period_end,
        User.email,
      )
      .outerjoin(User, User.telegram_id == Subscription.telegram_id)
      .order_by(Subscription.current_period_end.desc())
      .limit(safe_limit)
    )
    if active_only:
      query = query.where(Subscription.status.in_(["active", "trialing"])).where(Subscription.current_period_end > now)

    rows = (await session.execute(query)).all()

  items = []
  for telegram_id, status, current_period_end, email in rows:
    email_str = str(email or "")
    items.append(
      {
        "telegram_id": str(telegram_id),
        "status": str(status),
        "current_period_end": current_period_end.isoformat() if current_period_end else None,
        "email": email_str or None,
        "is_test_user": bool(email_str and "test" in email_str.lower()),
      }
    )

  return {"count": len(items), "active_only": active_only, "items": items}


@app.get("/current-plan")
async def current_plan(telegram_id: str, session: AsyncSession = Depends(get_session)):
  now = datetime.now(timezone.utc)
  sub = (
    await session.execute(
      select(Subscription)
      .where(Subscription.telegram_id == telegram_id)
      .where(Subscription.status.in_(["active", "trialing"]))
      .where(Subscription.current_period_end > now)
      .order_by(Subscription.current_period_end.desc())
      .limit(1)
    )
  ).scalars().first()
  
  if not sub:
    return {"plan": "free"}
  
  return {"plan": sub.plan or "pro"} # Default to pro for legacy active subs


@app.post("/checkout")
async def checkout(payload: CheckoutIn, session: AsyncSession = Depends(get_session)):
  code = payload.telegram_activation_code.strip().upper()
  plan_name = payload.plan.strip().lower()
  
  # Normalize institutional to elite
  if "institutional" in plan_name:
    plan_name = plan_name.replace("institutional", "elite")

  plan = (await session.execute(select(Plan).where(Plan.name == plan_name))).scalars().first()
  if not plan:
    raise HTTPException(status_code=404, detail=f"plan '{plan_name}' not found")

  if settings.payment_mode == "mock" or not settings.stripe_secret_key:
    url = await _activate_subscription(session, code=code, plan=plan, user_id=payload.user_id)
    return {"checkout_url": url, "mode": "mock"}

  url = create_checkout_session(
    stripe_price_id=plan.stripe_price_id,
    activation_code=code,
    plan=plan.name,
    user_id=payload.user_id,
  )
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
      user_id = str(metadata.get("user_id") or "").strip() or None
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
            
            # Extract plan from metadata or subscription items
            plan_from_meta = str(metadata.get("plan") or "pro").lower()

            await session.execute(
              insert(Subscription)
              .values(
                id=event_id[:64],
                telegram_id=telegram_id,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id,
                status="active",
                plan=plan_from_meta,
                current_period_end=current_period_end,
              )
              .on_conflict_do_update(
                index_elements=[Subscription.stripe_subscription_id],
                set_={
                    "status": "active", 
                    "plan": plan_from_meta,
                    "current_period_end": current_period_end, 
                    "telegram_id": telegram_id, 
                    "stripe_customer_id": stripe_customer_id
                },
              )
            )
            if user_id:
              await session.execute(
                update(User)
                .where(User.id == user_id)
                .values(
                  telegram_id=telegram_id,
                  plan=plan_from_meta.upper(),
                  plan_expire_at=current_period_end
                )
              )
            await session.execute(update(ActivationCode).where(ActivationCode.code == activation_code).values(used=True))

    if event_type in ("customer.subscription.deleted", "customer.subscription.canceled"):
      obj = event["data"]["object"]
      sid = str(obj.get("id") or "")
      if sid:
        # Find the telegram_id for this subscription
        sub = (await session.execute(select(Subscription).where(Subscription.stripe_subscription_id == sid))).scalars().first()
        if sub:
          # Update subscription status
          await session.execute(update(Subscription).where(Subscription.stripe_subscription_id == sid).values(status="canceled"))
          # Revert user to FREE plan
          await session.execute(
            update(User)
            .where(User.telegram_id == sub.telegram_id)
            .values(plan="FREE", plan_expire_at=None)
          )

    await session.commit()
  return {"ok": True}
