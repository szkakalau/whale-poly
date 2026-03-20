/**
 * `alert_events` dedup windows — keep formulas aligned with
 * `whale-monorepo/services/telegram_bot/delivery_cooldown.py`
 * (`base_cooldown_seconds`, `tier_cooldown_multiplier`, `cooldown_v2_min_seconds`).
 */

export type BillingPlan = 'FREE' | 'PRO' | 'ELITE';

function envFloat(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const NOTIONAL_FLOOR = envFloat('COOLDOWN_V2_NOTIONAL_FLOOR_USD', 1);
const NOTIONAL_CAP = envFloat('COOLDOWN_V2_NOTIONAL_CAP_USD', 10_000_000);
const MIN_SEC = envFloat('COOLDOWN_V2_MIN_SECONDS', 30);

export function computeEffectiveScore(input: {
  whaleScore?: number | null;
  size?: number | null;
  amount?: number | null;
}): number {
  const score = Number(input.whaleScore ?? 0);
  let notional = Number(input.size ?? input.amount ?? 0);
  if (!Number.isFinite(notional)) notional = 0;
  if (!Number.isFinite(score)) return 0;
  notional = Math.max(notional, NOTIONAL_FLOOR);
  notional = Math.min(notional, NOTIONAL_CAP);
  return score + Math.log10(notional) * 5;
}

function baseCooldownSeconds(effective: number): number {
  if (effective >= 95) return 60;
  if (effective >= 90) return 120;
  if (effective >= 85) return 300;
  if (effective >= 80) return 600;
  return 900;
}

function tierMultiplier(plan: BillingPlan): number {
  if (plan === 'FREE') return 2;
  if (plan === 'ELITE') return 0.5;
  return 1;
}

export function cooldownSecondsForPlan(effective: number, plan: BillingPlan): number {
  const base = baseCooldownSeconds(effective);
  const mult = tierMultiplier(plan);
  return Math.max(Math.floor(base * mult), MIN_SEC);
}

export function isDynamicAlertEventsCooldownEnabled(): boolean {
  const v = process.env.ALERT_EVENTS_DYNAMIC_COOLDOWN;
  if (!v) return false;
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}
