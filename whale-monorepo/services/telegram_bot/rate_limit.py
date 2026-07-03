from datetime import datetime, timezone
from redis.asyncio import Redis


def _daily_key(telegram_id: str) -> str:
    """Shared date-key builder — ensures both check and increment use the
    same UTC date, avoiding a boundary race at midnight (CR-I5)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"alert_limit:{telegram_id}:{today}"


# Lua script: atomically increment and set expiry if first increment.
# Prevents the incr/expire race where a crash between them causes
# a permanent rate-limit for the key.
_INCR_WITH_EXPIRE = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""

async def allow_send(redis: Redis, telegram_id: str, limit_per_minute: int) -> bool:
    if int(limit_per_minute) <= 0:
        return True
    key = f"rl:{telegram_id}"
    value = await redis.eval(_INCR_WITH_EXPIRE, 1, key, 60)
    return int(value) <= int(limit_per_minute)


# Lua script: atomically check AND increment the daily alert counter.
# Merges check + increment into a single atomic operation to close the TOCTOU
# window where two concurrent requests both read count=N-1, both pass the check,
# and the final count becomes N+1 (exceeding the limit).
# Uses INCR + conditional DECR to roll back if limit exceeded.
_ATOMIC_CHECK_AND_INCR = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local limit = tonumber(ARGV[2])
if count > limit then
    redis.call('DECR', KEYS[1])
    return 0
end
return 1
"""


async def check_daily_alert_limit(redis: Redis, telegram_id: str, max_alerts_per_day: int | str) -> bool:
    """Pure read check — fast, no side effects. Paired with try_increment_daily_alert_count."""
    if max_alerts_per_day == "unlimited" or (isinstance(max_alerts_per_day, int) and max_alerts_per_day < 0):
        return True

    key = _daily_key(telegram_id)
    count = await redis.get(key)
    if count and int(count) >= int(max_alerts_per_day):
        return False

    return True


async def try_increment_daily_alert_count(redis: Redis, telegram_id: str, max_alerts_per_day: int | str) -> bool:
    """Atomically increment the daily counter IF under limit. Returns True if allowed + incremented."""
    if max_alerts_per_day == "unlimited" or (isinstance(max_alerts_per_day, int) and max_alerts_per_day < 0):
        return True

    key = _daily_key(telegram_id)
    limit = int(max_alerts_per_day)

    result = await redis.eval(_ATOMIC_CHECK_AND_INCR, 1, key, 25 * 3600, limit)
    return int(result) == 1


async def increment_daily_alert_count(redis: Redis, telegram_id: str):
    """Legacy: unconditionally increment (used where limit was already checked atomically)."""
    key = _daily_key(telegram_id)
    # Atomically increment and set expiry to 25 hours
    await redis.eval(_INCR_WITH_EXPIRE, 1, key, 25 * 3600)
