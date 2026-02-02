from redis.asyncio import Redis


async def allow_send(redis: Redis, telegram_id: str, limit_per_minute: int) -> bool:
  if int(limit_per_minute) <= 0:
    return True
  key = f"rl:{telegram_id}"
  value = await redis.incr(key)
  if value == 1:
    await redis.expire(key, 60)
  return int(value) <= int(limit_per_minute)
