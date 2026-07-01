from datetime import datetime, timezone
from redis.asyncio import Redis


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


async def check_daily_alert_limit(redis: Redis, telegram_id: str, max_alerts_per_day: int | str) -> bool:
    if max_alerts_per_day == "unlimited" or (isinstance(max_alerts_per_day, int) and max_alerts_per_day < 0):
        return True
    
    # Use UTC date as part of the key
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"alert_limit:{telegram_id}:{today}"
    
    count = await redis.get(key)
    if count and int(count) >= int(max_alerts_per_day):
        return False
    
    return True


async def increment_daily_alert_count(redis: Redis, telegram_id: str):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"alert_limit:{telegram_id}:{today}"

    # Atomically increment and set expiry to 25 hours (prevents race)
    await redis.eval(_INCR_WITH_EXPIRE, 1, key, 25 * 3600)
