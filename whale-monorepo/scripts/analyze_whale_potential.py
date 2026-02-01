
import asyncio
import httpx
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

async def analyze_whale_potential():
    url = "https://data-api.polymarket.com/trades?limit=500"
    proxies = os.getenv("HTTPS_PROXY")
    
    async with httpx.AsyncClient(proxies=proxies) as client:
        try:
            resp = await client.get(url, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                print(f"Analyzing {len(data)} recent trades...")
                
                whales = []
                for t in data:
                    size = float(t.get("size") or 0)
                    price = float(t.get("price") or 0)
                    usd = size * price
                    if usd >= 2000:
                        whales.append({
                            "time": datetime.fromtimestamp(int(t.get("timestamp")), tz=timezone.utc),
                            "usd": usd,
                            "title": t.get("title")
                        })
                
                if not whales:
                    print("No trades >= $2000 found in the last 500 trades.")
                else:
                    print(f"Found {len(whales)} trades >= $2000:")
                    for w in whales:
                        print(f"[{w['time']}] ${w['usd']:.2f} - {w['title']}")
            else:
                print(f"Error fetching data: {resp.status_code}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(analyze_whale_potential())
