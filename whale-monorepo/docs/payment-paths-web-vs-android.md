# Payment paths: Web (Stripe) vs Android (Google Play)

This repo supports **two separate subscription flows**. Do not mix them in product specs or API reviews.

## Web / Telegram checkout (Stripe)

- **Client**: Landing web app, Telegram Mini App, browser.
- **Backend**: [`services/payment`](../services/payment/api.py) exposes `/checkout`, Stripe webhooks, plan rows keyed for Stripe price IDs.
- **Landing proxy**: [`services/landing/src/app/api/checkout/route.ts`](../services/landing/src/app/api/checkout/route.ts) forwards to `PAYMENT_API_BASE_URL` with activation code + plan.
- **Activation**: Often tied to Telegram activation codes and `users` / `subscriptions` (SQLAlchemy `subscriptions` table in shared Postgres).

Use this path when the user pays **outside Google Play** (card via Stripe on web).

## Android (Google Play Billing)

- **Client**: [`apps/android`](../apps/android) uses Play Billing Library; purchases return a **purchase token** and **product id** (SKU).
- **Entitlement sync**: App calls **Landing** `POST /api/mobile/billing/google/sync` with Bearer auth (see [`mobile-api-v1.md`](./mobile-api-v1.md)).
- **Server verification**: Production should use **Google Play Developer API** (`purchases.subscriptions.get`) with a **service account**; see env vars in [`../.env.example`](../.env.example) and implementation in [`services/landing/src/lib/googlePlayVerify.ts`](../services/landing/src/lib/googlePlayVerify.ts).

Use this path when the user subscribes **inside the Android app** distributed on Google Play.

## Why two paths

- Google Play policy: **digital goods/features** sold in an Android app distributed through Play are generally expected to use **Play Billing**, not an external web card flow, for that app’s in-app entitlement.
- Stripe remains valid for **web** and **non-Play** channels.

## Review checklist

- [ ] “MVP payment” explicitly names **Android Play** vs **Web Stripe**.
- [ ] QA has test accounts for **both** if both ship.
- [ ] Production Android sync has **Play API verification** enabled (no trust-only client body).
