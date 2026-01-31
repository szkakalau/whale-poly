import asyncio
from shared.config import settings
from redis.asyncio import Redis

async def check():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    
    # Check alert_created queue length
    alert_queue_length = await redis.llen(settings.alert_created_queue)
    print(f'Alert created queue length: {alert_queue_length}')
    
    # Try to pop one message to see the format
    if alert_queue_length > 0:
        message = await redis.rpop(settings.alert_created_queue)
        if message:
            print(f'Sample alert message: {message}')
            # Put it back for processing
            await redis.rpush(settings.alert_created_queue, message)
    else:
        print('No messages in alert_created queue')

if __name__ == "__main__":
    asyncio.run(check())