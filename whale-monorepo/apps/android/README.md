# Whale Android MVP

## Scope

This Android app is the MVP client for:

- Leaderboard (`/api/smart-money/leaderboard`)
- Live Signals (`/api/live-signals`)
- Whale Detail (`/api/mobile/whales/{wallet}`)

## Run

1. Start landing API at `http://localhost:3000`.
2. Open `apps/android` in Android Studio.
3. Build and run app module on emulator.

The app defaults to `http://10.0.2.2:3000` for local emulator access.

## Command-line build (Gradle Wrapper)

From the `apps/android` directory:

```bash
chmod +x gradlew
./gradlew :app:assembleDebug
```

CI runs the same job on changes under `whale-monorepo/apps/android/` (see `.github/workflows/android-ci.yml`).

## Login (required before Play billing sync)

Subscription sync calls `POST /api/mobile/billing/google/sync`, which requires `Authorization: Bearer`.

1. Open the **Subscription** tab.
2. Paste Telegram Mini App `initData` (same string the web client sends to `/api/mobile/auth/telegram`).
3. Tap **Login** — the app stores the access token and sends it on subsequent API calls.
4. Then use **Buy Pro / Buy Elite** to sync the purchase to the backend.

**Logout** clears the stored token.
