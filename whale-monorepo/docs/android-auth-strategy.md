# Android authentication strategy

## Current (MVP)

- **Primary login**: Telegram Mini App **`initData`** verified server-side (`POST /api/mobile/auth/telegram`), same trust model as the web Mini App.
- **Session**: HMAC-signed **Bearer access token** ([`mobileAuth.ts`](../services/landing/src/lib/mobileAuth.ts)), stored on device ([`MobileSession.kt`](../apps/android/app/src/main/java/com/sightwhale/android/MobileSession.kt)), sent on protected routes.
- **Parallel web auth**: Cookie `tg_session` + `x-user-id` injection remains unchanged for browser clients.

This matches a product where users already discover the product **via Telegram** and open the native app as a companion.

## Out of scope for MVP (explicit)

- **Google Sign-In** (OAuth) as the primary identity.
- **Email/password** auth.
- **Phone OTP**.

## Future (P1+)

When expanding beyond Telegram-first users, add one of:

1. **Google Sign-In** on Android → backend endpoint issues the **same** mobile access token shape after linking `User` (new column `googleSub` or dedicated account link table).
2. **Apple Sign-In** if iOS ships.

Until then, docs and QA should describe the app as **Telegram-authenticated** on mobile, not “Google account only.”

## Related docs

- [mobile-api-v1.md](./mobile-api-v1.md)
- [payment-paths-web-vs-android.md](./payment-paths-web-vs-android.md)
