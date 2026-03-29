# Android Play Release (Phased)

## Track Plan

1. Internal testing (team only)
2. Closed testing (small invite cohort)
3. Production staged rollout:
   - 5%
   - 20%
   - 50%
   - 100%

Advance to next stage only when quality gates pass.

## Quality Gates

- Crash-free sessions >= 99.5%
- No P0/P1 blocking bug in:
  - app launch
  - leaderboard load
  - signals load
  - whale detail load
  - subscription purchase and entitlement sync
- Billing sync API success >= 99%
- No regression on web checkout and web auth paths

## Play Console Checklist

- App signing configured
- Data safety form complete
- Privacy policy URL published
- Content rating completed
- Test account instructions provided for review
- Subscription products created:
  - `pro_monthly`
  - `pro_yearly`
  - `elite_monthly`
  - `elite_yearly`

## Rollback Plan

- If purchase flow fails:
  - pause production rollout
  - disable purchase CTA in app via remote config or emergency flag
  - hotfix backend sync endpoint
- If crash rate spikes:
  - halt rollout
  - ship hotfix build to internal first

## Post-Release Monitoring

- Daily checks for first 7 days:
  - Play Console vitals (crash, ANR)
  - backend logs for `/api/mobile/billing/google/sync`
  - plan entitlement mismatch count
