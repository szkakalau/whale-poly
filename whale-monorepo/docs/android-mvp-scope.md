# Android MVP Scope Freeze

## Product Goal

Ship an Android MVP to Google Play with a complete subscription loop:

1. Browse signal content.
2. Sign in.
3. Purchase subscription.
4. Subscription entitlements become effective in app.

## In Scope (P0)

- Android native app (Kotlin + Compose).
- Read-only pages:
  - Leaderboard
  - Live signals
  - Whale detail
- Mobile auth token flow (parallel to existing web cookie flow).
- Google Play Billing purchase flow.
- Backend subscription sync endpoint for Android purchases.
- Play Console staged rollout checklist and launch gate.

## Out Of Scope (P1+)

- iOS app.
- Full push notification migration to FCM.
- WebSocket real-time streaming.
- Social/community features.
- Advanced personalization.

## Payment and auth references

- **Web Stripe vs Android Play**: see [payment-paths-web-vs-android.md](./payment-paths-web-vs-android.md).
- **Login strategy (Telegram now, Google later)**: see [android-auth-strategy.md](./android-auth-strategy.md).
- **Observability (MVP vs P1)**: see [android-mvp-observability.md](./android-mvp-observability.md).

## MVP API Surface (Frozen v1)

- `GET /api/smart-money/leaderboard`
- `GET /api/live-signals`
- `GET /api/mobile/whales/{wallet}` (proxies whale-engine; use this for mobile clients)
- `POST /api/mobile/auth/telegram`
- `POST /api/mobile/auth/refresh`
- `GET /api/mobile/me`
- `POST /api/mobile/billing/google/sync`
- `GET /api/me/plan`

## Non-Functional Acceptance

- App cold start: under 3 seconds on modern mid-range Android device.
- Crash-free session target: >= 99.5% in internal testing.
- API success rate target for P0 endpoints: >= 99%.
- Billing path (purchase or restore) works end-to-end with no manual DB patching.

How these are measured in MVP (vs full client telemetry) is defined in [android-mvp-observability.md](./android-mvp-observability.md).

## Release Gate

MVP is considered done only if all are true:

- Internal testing has no P0/P1 blockers.
- Login and subscription entitlement are stable for 7 consecutive days.
- Play Console privacy and data safety forms are complete.
- Production release checklist is fully checked.
