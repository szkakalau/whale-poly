import type { AuthUser } from '@/lib/auth';
import type { LiveSignal } from '@/lib/live-signals';
import { Plan } from '@prisma/client';

/** Today 00:00:00.000 UTC */
export function getUtcTodayStart(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function isPaidLiveSignalsUser(user: AuthUser | null): boolean {
  if (!user) return false;
  const plan = user.plan as Plan;
  if (plan !== Plan.PRO && plan !== Plan.ELITE) return false;
  if (user.planExpireAt && new Date() > user.planExpireAt) return false;
  return true;
}

/**
 * Guests and free users: signals delayed by 1 hour.
 * Paid (active Pro/Elite): no filter — full real-time feed.
 */
export function filterLiveSignalsForUser(signals: LiveSignal[], user: AuthUser | null): LiveSignal[] {
  if (isPaidLiveSignalsUser(user)) {
    return signals;
  }
  // Non-paid users see all signals except the most recent 1 hour
  const boundary = Date.now() - 60 * 60 * 1000;
  return signals.filter((s) => {
    const t = new Date(s.occurredAt).getTime();
    return Number.isFinite(t) && t < boundary;
  });
}
