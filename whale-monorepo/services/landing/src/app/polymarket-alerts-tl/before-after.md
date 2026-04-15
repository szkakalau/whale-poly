# Polymarket Alerts TL — Before/After

This note summarizes the landing + checkout changes made from product review feedback.

## Before

- **FAQ structure**
  - 7-day refund / risk reversal lived in a separate section, not the first thing users saw in FAQ.
  - FAQ order did not match highest-intent questions (speed → delivery → Whale Score → volume → compliance).

- **Social proof near screenshots**
  - “Real alerts” section showed screenshots only, with no Reddit-style testimonials to support paid Reddit traffic trust patterns.

- **CTA coverage**
  - Several core sections ended without a direct “buy now” action, forcing users to scroll to find the next CTA.

- **Checkout abandonment recovery**
  - `/subscribe` had no exit-intent / back-intercept recovery to reduce drop-offs before redirecting to hosted checkout.

- **Discount application**
  - No way to apply a time-limited first-month discount to Stripe Checkout sessions.

## After

- **FAQ optimized for conversion**
  - Added a **bold, highlighted** “7-Day No-Questions-Asked Refund” callout at the **top of the FAQ**.
  - Reordered FAQ to: **speed → delivery → Whale Score → alerts per day → compliance**, then secondary questions.

- **Reddit testimonials added**
  - Added 4 quote cards under the screenshot grid, formatted as `u/...` + `r/Polymarket` style social proof.

- **CTA coverage across the page**
  - Added section-level CTAs after core modules so users can start checkout at any high-conviction moment.
  - CTAs deep-link to `/subscribe?plan=pro` (default) or `/subscribe?plan=elite`.

- **Abandonment recovery on `/subscribe`**
  - Added an exit-intent modal:
    - Desktop: top-edge mouse leave.
    - Mobile: first back navigation intercept.
  - Modal offers: **“10% Off Your First Month, only for the next 10 minutes”** with countdown.

- **Stripe discount applied automatically (when configured)**
  - Checkout requests can pass `apply_promo`.
  - Payment service applies Stripe `discounts=[{promotion_code: ...}]` when:
    - `apply_promo=true`
    - `STRIPE_PROMO_FIRST_MONTH_10_OFF` is set in environment.

