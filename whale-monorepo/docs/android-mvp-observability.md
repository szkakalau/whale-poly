# Android MVP observability (scope vs plan)

The original roadmap called for **crash reporting, API error telemetry, and page load timing** in phase 1. This document **narrows MVP acceptance** so shipping is not blocked on third-party SDKs, while keeping a clear **P1 upgrade path**.

## MVP (P0) — accepted scope

- **Local diagnostics**: Android `Log` via [`AppTelemetry`](../apps/android/app/src/main/java/com/sightwhale/android/AppTelemetry.kt) for key flows (login, billing sync errors, network failures surfaced to UI).
- **HTTP debugging**: OkHttp `HttpLoggingInterceptor` at **BASIC** level in debug builds (see `WhaleRepository`).
- **Backend metrics**: Existing server logs for `/api/mobile/*` and payment sync; no change required for MVP.

**Explicitly deferred for MVP**: Firebase Crashlytics, Analytics, distributed tracing, automated dashboard SLOs.

## P1 — production hardening

- Integrate **Firebase Crashlytics** (or equivalent) with release mapping files.
- Add **Analytics** events: screen views, login success/failure, purchase start/success/failure, API latency buckets.
- Optional **OpenTelemetry** or vendor APM for client network spans.
- Define **SLOs** (crash-free sessions, p95 API latency) aligned with [`android-mvp-scope.md`](./android-mvp-scope.md).

## How to reconcile with acceptance criteria

| Criterion in scope doc | MVP interpretation |
|------------------------|--------------------|
| Crash-free session ≥ 99.5% | Measured in **Internal testing** using Play Console vitals + manual QA; Crashlytics not a gate for first internal build. |
| API success ≥ 99% | Measured on **server-side** logs and QA scripts; client SDK not required. |

When P1 ships, tighten criteria to include **automated** crash reporting and client-side event funnels.
