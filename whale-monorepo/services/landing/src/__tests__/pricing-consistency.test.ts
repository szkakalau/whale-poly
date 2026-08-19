import { describe, it, expect } from 'vitest';
import {
  PRICING_PRO_MONTHLY,
  PRICING_PRO_YEARLY,
  PRICING_ELITE_MONTHLY,
  PRICING_ELITE_YEARLY,
  PRICING_PLAN_CARDS,
} from '@/lib/pricing-plans';
import { PRODUCT_PLAN_MAP } from '@/app/api/mobile/billing/google/sync/route';

/**
 * Trust-baseline guard: pricing has one source of truth (`pricing-plans.ts`).
 *
 * The Google Play billing sync route must never drift from the marketing
 * price cards — these assertions fail the moment someone re-hardcodes a price
 * in `PRODUCT_PLAN_MAP` instead of referencing the exported constants.
 */
describe('pricing consistency', () => {
  it('Google Play sync prices match the pricing-plans constants', () => {
    expect(PRODUCT_PLAN_MAP.pro_monthly.price).toBe(PRICING_PRO_MONTHLY);
    expect(PRODUCT_PLAN_MAP.pro_yearly.price).toBe(PRICING_PRO_YEARLY);
    expect(PRODUCT_PLAN_MAP.elite_monthly.price).toBe(PRICING_ELITE_MONTHLY);
    expect(PRODUCT_PLAN_MAP.elite_yearly.price).toBe(PRICING_ELITE_YEARLY);
  });

  it('yearly price is ~10 months of the monthly price', () => {
    expect(PRICING_PRO_YEARLY).toBe(PRICING_PRO_MONTHLY * 10);
    expect(PRICING_ELITE_YEARLY).toBe(PRICING_ELITE_MONTHLY * 10);
  });

  it('marketing plan cards carry the canonical Pro/Elite values', () => {
    const pro = PRICING_PLAN_CARDS.find((p) => p.tier === 'pro');
    const elite = PRICING_PLAN_CARDS.find((p) => p.tier === 'elite');

    expect(pro?.monthly).toBe(29);
    expect(pro?.yearly).toBe(290);
    expect(elite?.monthly).toBe(59);
    expect(elite?.yearly).toBe(590);
  });
});
