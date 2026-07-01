/**
 * In-memory rate limiter with sliding window.
 *
 * Tracks per-user AND per-IP request counts.
 * Limits: 10 queries/minute, 50 queries/hour per key.
 *
 * NOTE: In serverless / multi-instance deployments, each instance has its own
 * store — this provides basic protection but is not a global limit. For
 * production use, replace with Redis-backed rate limiting (Upstash Redis
 * recommended for Vercel/Next.js compatibility).
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
// Stricter limits for unauthenticated / IP-based access
const IP_MINUTE_LIMIT = 5;
const IP_HOUR_LIMIT = 20;

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

function _checkLimit(key: string, minLimit: number, hourLimit: number): RateLimitResult {
  cleanup();

  const now = Date.now();
  let w = store.get(key);

  if (!w || now - w.minuteStart > MINUTE_MS) {
    store.set(key, {
      minuteStart: now,
      minuteCount: 1,
      hourStart: w && now - w.hourStart <= HOUR_MS ? w.hourStart : now,
      hourCount: w && now - w.hourStart <= HOUR_MS ? w.hourCount + 1 : 1,
    });
    return { allowed: true, remaining: minLimit - 1 };
  }

  if (now - w.minuteStart > MINUTE_MS) {
    w.minuteStart = now;
    w.minuteCount = 0;
  }
  if (now - w.hourStart > HOUR_MS) {
    w.hourStart = now;
    w.hourCount = 0;
  }

  w.minuteCount++;
  w.hourCount++;

  if (w.minuteCount > minLimit) {
    const retryAfterSec = Math.ceil((w.minuteStart + MINUTE_MS - now) / 1000);
    return { allowed: false, retryAfterSec, message: `Too many requests. Retry in ${retryAfterSec}s.` };
  }

  if (w.hourCount > hourLimit) {
    const retryAfterSec = Math.ceil((w.hourStart + HOUR_MS - now) / 1000);
    return { allowed: false, retryAfterSec, message: `Hourly limit reached. Retry in ${Math.ceil(retryAfterSec / 60)}min.` };
  }

  return { allowed: true, remaining: minLimit - w.minuteCount };
}

/**
 * Per-user rate limiting. Use for authenticated endpoints.
 */
export function checkRateLimit(userId: string): RateLimitResult {
  return _checkLimit(`u:${userId}`, MINUTE_LIMIT, HOUR_LIMIT);
}

/**
 * Per-IP rate limiting. Use for unauthenticated endpoints (auth, checkout).
 */
export function checkRateLimitByIp(ip: string): RateLimitResult {
  return _checkLimit(`ip:${ip}`, IP_MINUTE_LIMIT, IP_HOUR_LIMIT);
}

/** For testing: reset all state. */
export function resetRateLimiter(): void {
  store.clear();
}
