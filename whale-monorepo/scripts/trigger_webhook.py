import json
import time
import hmac
import hashlib
import urllib.request
import sys

# ================= 配置区域 =================
# 1. 请填入你的 Webhook 签名密钥 (在 Stripe Dashboard -> Developers -> Webhooks -> 你的端点 -> Signing secret)
WEBHOOK_SECRET = "whsec_..." 

# 2. 请填入目标 URL (你的 Render 服务地址)
WEBHOOK_URL = "https://payment-api-6wk6.onrender.com/webhook"

# 3. 请从你的截图 JSON 中找到以下两个 ID 填入 (必须是真实存在的)
CUSTOMER_ID = "cus_TwdCIO6NQjilqg"       # 例如: cus_P...
SUBSCRIPTION_ID = "sub_1SyjwF7479xkrVpGVnfRUlix"   # 例如: sub_1...

# 4. 激活码 (已知)
ACTIVATION_CODE = "E7Q8MEDY"
# ===========================================

def trigger():
    if WEBHOOK_SECRET.startswith("whsec_...") or CUSTOMER_ID.startswith("cus_...") or SUBSCRIPTION_ID.startswith("sub_..."):
        print("❌ 请先编辑脚本，填入正确的 WEBHOOK_SECRET, CUSTOMER_ID 和 SUBSCRIPTION_ID")
        return

    payload_data = {
        "id": "evt_manual_replay_" + str(int(time.time())),
        "object": "event",
        "api_version": "2023-10-16",
        "created": int(time.time()),
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_manual_replay_" + str(int(time.time())),
                "object": "checkout.session",
                "customer": CUSTOMER_ID,
                "subscription": SUBSCRIPTION_ID,
                "metadata": {
                    "activation_code": ACTIVATION_CODE,
                    "plan": "pro"
                },
                "payment_status": "paid",
                "status": "complete",
                "mode": "subscription"
            }
        }
    }

    payload_str = json.dumps(payload_data)
    timestamp = int(time.time())
    
    # 生成签名 (Manual HMAC-SHA256)
    signed_payload = f"{timestamp}.{payload_str}"
    signature = hmac.new(
        key=WEBHOOK_SECRET.encode("utf-8"),
        msg=signed_payload.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    header = f"t={timestamp},v1={signature}"

    print(f"🚀 正在发送 Webhook 到 {WEBHOOK_URL} ...")
    
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=payload_str.encode("utf-8"),
        headers={
            "Stripe-Signature": header,
            "Content-Type": "application/json",
            "User-Agent": "Stripe/v1 ManualTrigger/1.0"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Response Code: {response.status}")
            print(f"Response Body: {response.read().decode('utf-8')}")
            print("✅ Webhook 触发成功！请检查数据库是否已激活。")
    except urllib.error.URLError as e:
        print(f"❌ 网络/SSL 错误: {e}")
        print("💡 提示: 'EOF occurred' 通常意味着服务器在处理请求时崩溃了。")
        print("👉 请检查 Render 日志，很有可能是数据库表不存在 (Did you run 'alembic upgrade head'?)")

    # 打印 Curl 命令供调试
    print("\n--- 调试用 Curl 命令 ---")
    print(f"curl -i -X POST {WEBHOOK_URL} \\")
    print(f"  -H 'Stripe-Signature: {header}' \\")
    print(f"  -H 'Content-Type: application/json' \\")
    print(f"  -d '{payload_str}'")


if __name__ == "__main__":
    trigger()
