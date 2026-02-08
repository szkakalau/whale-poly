from datetime import datetime, timezone
from redis.asyncio import Redis


async def allow_send(redis: Redis, telegram_id: str, limit_per_minute: int) -> bool:
    if int(limit_per_minute) <= 0:
        return True
    key = f"rl:{telegram_id}"
    value = await redis.incr(key)
    if value == 1:
        await redis.expire(key, 60)
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
    
    # Increment and set expiry to 25 hours to ensure it covers the day
    await redis.incr(key)
    await redis.expire(key, 25 * 3600)
