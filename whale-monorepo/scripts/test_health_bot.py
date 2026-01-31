import asyncio
import httpx
import os
from dotenv import load_dotenv

async def test_bot():
    # 尝试加载多种可能的 .env 路径
    load_dotenv() # 当前目录
    load_dotenv("whale-monorepo/.env") # 项目根目录
    
    token = os.getenv("TELEGRAM_HEALTH_BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_HEALTH_CHAT_ID") or os.getenv("TELEGRAM_CHAT_ID")
    
    print(f"正在测试配置:")
    token_display = f"{token[:10]}...{token[-5:]}" if token and len(token) > 15 else str(token)
    print(f"Token: {token_display}")
    print(f"Chat ID: {chat_id}")
    print("-" * 20)

    if not token or not chat_id:
        print("错误: 请先在 .env 中配置 TELEGRAM_HEALTH_BOT_TOKEN 和 TELEGRAM_HEALTH_CHAT_ID")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": "✅ 健康检查机器人配置测试成功！",
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                print("🎉 发送成功！请检查你的 Telegram 手机客户端。")
            else:
                print(f"❌ 发送失败: 状态码 {resp.status_code}")
                print(f"响应内容: {resp.text}")
        except Exception as e:
            print(f"❌ 请求发生异常: {e}")

if __name__ == "__main__":
    asyncio.run(test_bot())
