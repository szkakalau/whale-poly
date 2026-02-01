
import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

async def test_polymarket_api():
    url = "https://data-api.polymarket.com/trades?limit=10"
    proxies = os.getenv("HTTPS_PROXY")
    print(f"Using proxy: {proxies}")
    
    async with httpx.AsyncClient(proxies=proxies) as client:
        try:
            resp = await client.get(url, timeout=30)
            print(f"Status Code: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Fetched {len(data)} trades")
                if data:
                    print(f"First trade sample: {data[0]}")
            else:
                print(f"Error: {resp.text[:500]}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_polymarket_api())
