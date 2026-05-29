/**
 * Simple in-memory rate limiter.
 * Tracks per-user (or per-chat) request counts with a sliding window.
 *
 * Limits: 10 queries/minute, 50 queries/hour per user.
 */

type Window = {
  minuteStart: number;
  minuteCount: number;
  hourStart: number;
  hourCount: number;
};

const store = new Map<string, Window>();

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const MINUTE_LIMIT = 10;
const HOUR_LIMIT = 50;

// Periodic cleanup to prevent memory leak from abandoned keys
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return; // every 5 min
  lastCleanup = now;
  for (const [key, w] of store) {
    if (now - w.hourStart > HOUR_MS + 60_000) {
      store.delete(key);
    }
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number; message: string };

export function checkRateLimit(userId: string): RateLimitResult {
  cleanup();

  const now = Date.now();
  let w = store.get(userId);

  if (!w || now - w.minuteStart > MINUTE_MS) {
    // New minute window
    store.set(userId, {
      minuteStart: now,
      minuteCount: 1,
      hourStart: w && now - w.hourStart <= HOUR_MS ? w.hourStart : now,
      hourCount: w && now - w.hourStart <= HOUR_MS ? w.hourCount + 1 : 1,
    });
    return { allowed: true, remaining: MINUTE_LIMIT - 1 };
  }

  // Reset minute counter if window expired
  if (now - w.minuteStart > MINUTE_MS) {
    w.minuteStart = now;
    w.minuteCount = 0;
  }
  // Reset hour counter if window expired
  if (now - w.hourStart > HOUR_MS) {
    w.hourStart = now;
    w.hourCount = 0;
  }

  w.minuteCount++;
  w.hourCount++;

  // Check limits
  if (w.minuteCount > MINUTE_LIMIT) {
    const retryAfterSec = Math.ceil((w.minuteStart + MINUTE_MS - now) / 1000);
    return {
      allowed: false,
      retryAfterSec,
      message: `⏳ Too many requests. Please try again in ${retryAfterSec} seconds.`,
    };
  }

  if (w.hourCount > HOUR_LIMIT) {
    const retryAfterSec = Math.ceil((w.hourStart + HOUR_MS - now) / 1000);
    return {
      allowed: false,
      retryAfterSec,
      message: `⏳ Hourly request limit reached (${HOUR_LIMIT}). Please try again in ${Math.ceil(retryAfterSec / 60)} minutes.`,
    };
  }

  return { allowed: true, remaining: MINUTE_LIMIT - w.minuteCount };
}

/** For testing: reset all state. */
export function resetRateLimiter(): void {
  store.clear();
}
