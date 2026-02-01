
import asyncio
from redis.asyncio import Redis

async def main():
    redis = Redis.from_url("redis://localhost:6379/0", decode_responses=True)
    clients = await redis.client_list()
    for client in clients:
        print(f"ID: {client['id']}, Addr: {client['addr']}, Name: {client.get('name', 'N/A')}, Cmd: {client['cmd']}")

if __name__ == "__main__":
    asyncio.run(main())
