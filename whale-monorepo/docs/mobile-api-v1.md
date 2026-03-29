# Mobile API v1 Contract

Base URL (dev): `http://localhost:3000`

Auth:

- Public endpoints: no auth required.
- Private endpoints: `Authorization: Bearer <accessToken>`.
- Access token source: `POST /api/mobile/auth/telegram`.

## 1) Authenticate (Telegram initData)

- Method: `POST`
- Path: `/api/mobile/auth/telegram`
- Body:

```json
{
  "initData": "query_id=...&user=...&hash=..."
}
```

- 200 response:

```json
{
  "ok": true,
  "accessToken": "token",
  "expiresIn": 604800,
  "user": {
    "id": "cuid",
    "telegramId": "123456",
    "plan": "FREE",
    "planExpireAt": null
  }
}
```

## 2) Refresh access token

- Method: `POST`
- Path: `/api/mobile/auth/refresh`
- Header: `Authorization: Bearer <accessToken>`

## 3) Current user

- Method: `GET`
- Path: `/api/mobile/me`
- Header: `Authorization: Bearer <accessToken>`

## 4) Leaderboard

- Method: `GET`
- Path: `/api/smart-money/leaderboard`
- Query:
  - `orderBy`: `PNL | VOL | ROI`
  - `timePeriod`: `DAY | WEEK | MONTH | ALL`
  - `category`: `OVERALL | POLITICS | SPORTS | CRYPTO | CULTURE | MENTIONS | WEATHER | ECONOMICS | TECH | FINANCE`
  - `limit`: `1..50`

## 5) Live signals

- Method: `GET`
- Path: `/api/live-signals`

## 6) Whale detail (mobile wrapper)

- Method: `GET`
- Path: `/api/mobile/whales/{wallet}`

## 7) Plan status

- Method: `GET`
- Path: `/api/me/plan`
- Header: `Authorization: Bearer <accessToken>` (optional; anonymous returns FREE)

## 8) Google Play subscription sync

- Method: `POST`
- Path: `/api/mobile/billing/google/sync`
- Header: `Authorization: Bearer <accessToken>`
- **Server verification**: When `GOOGLE_PLAY_PACKAGE_NAME` and a service account (`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` or `GOOGLE_PLAY_SERVICE_ACCOUNT_B64`) are set, the server calls **Google Play Developer API** `purchases.subscriptions.get` and uses **Google’s expiry time** (not client `expiryTimeMs`). Production (`NODE_ENV`/`VERCEL_ENV` production) **requires** this configuration.
- Body:

```json
{
  "purchaseToken": "token-from-play",
  "productId": "pro_monthly",
  "orderId": "GPA.1234-5678-9012-34567",
  "purchaseTimeMs": 1735689600000,
  "expiryTimeMs": 1738368000000,
  "isAutoRenewing": true
}
```

`expiryTimeMs` is required only when server verification is **not** configured (local/dev).

## Error format

All endpoints return JSON for errors:

```json
{
  "detail": "error_code_or_message"
}
```
