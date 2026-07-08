# SightWhale 统一部署指南 — $17.50/月

## 概述

将 8 个 Render 微服务 + Redis 整合为 1 个服务，成本从 $127/月 降至 $17.50/月。

## 代码变更总结

### 新增文件
- `services/unified/__init__.py` — 空包标记
- `services/unified/memory_store.py` — InMemoryRedis（Redis API 兼容的内存实现）
- `services/unified/worker_loop.py` — 所有后台 Worker 的 asyncio 替代
- `services/unified/app.py` — 统一 FastAPI 入口（挂载所有子 API + 启动所有 Worker）
- `docker/entrypoint-unified.sh` — Render 启动脚本

### 修改文件
- `render.yaml` — 8 services + Redis → 1 service + PG
- `docker/docker-compose.yml` — 新增 sightwhale 统一服务
- `shared/config.py` — REDIS_URL 改为可选
- `shared/async_utils.py` — 无 Redis 时自动使用 InMemoryRedis
- `services/trade_ingest/api.py` — Redis 连接统一化
- `services/telegram_bot/api.py` — 诊断端点使用共享连接
- `services/telegram_bot/handlers.py` — 使用共享连接
- `services/telegram_bot/vw_pusher.py` — 使用共享连接
- `.env.example` — 更新 REDIS_URL 注释
- `Makefile` — 新增 unified 命令

## 部署步骤

### Step 1: 推送代码
```bash
cd whale-poly
git add .
git commit -m "Consolidate 8 services into 1 unified app with InMemoryRedis

Eliminates Redis dependency, Celery dependency, and 7 Render services.
Uses in-memory queues and asyncio background tasks instead.
All 65 existing tests pass.

Cost: $127.37/mo → $17.50/mo (86% reduction)"
git push
```

### Step 2: Render 自动部署
Render 会检测到 `render.yaml` 的变更并自动创建 `sightwhale` 服务。
旧的服务（trade-ingest-api, whale-engine-api 等）此时仍然运行，不会中断。

### Step 3: 降级 Postgres
在 Render Dashboard → whale-postgres → Settings → Plan → 改为 Starter ($10.50/月)
- Render 会自动处理迁移（无数据丢失，同一集群内降级）

### Step 4: 验证新服务
1. 访问 `https://sightwhale.onrender.com/health` — 应返回 `{"status": "ok", "mode": "inmemory"}`
2. 访问 `https://sightwhale.onrender.com/blog/posts?language=en` — 应返回博客列表
3. 访问 `https://sightwhale.onrender.com/whale/health` — 应返回 `{"status": "ok"}`
4. 访问 `https://sightwhale.onrender.com/alert/health` — 应返回 `{"status": "ok"}`
5. 访问 `https://sightwhale.onrender.com/payment/healthz` — 应返回 `{"status": "ok"}`

### Step 5: 更新 Vercel 环境变量
在 Vercel Dashboard → SightWhale landing → Settings → Environment Variables:

**修改：**
- `TRADE_INGEST_API_URL` → `https://sightwhale.onrender.com`
- `NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL` → `https://sightwhale.onrender.com/whale`
- `PAYMENT_API_BASE_URL` → `https://sightwhale.onrender.com/payment`

### Step 6: 更新 Stripe Webhook
在 Stripe Dashboard → Webhooks → 修改端点 URL：
- 旧: `https://payment-api.onrender.com/webhook`
- 新: `https://sightwhale.onrender.com/payment/webhook`

### Step 7: 删除旧 Render 服务（确认新服务稳定后）
在 Render Dashboard 中依次删除：
- trade-ingest-api
- trade-ingest-worker
- whale-engine-api
- whale-engine-worker
- alert-engine-api
- alert-engine-worker
- telegram-bot
- payment-api
- whale-redis
- spirit-talker-db（如果不再使用）
- karmaforge（如果不再使用）

### Step 8: 降级计划
Render Dashboard → Billing → Plan → 改为 Individual ($0/月)

## 回滚方案（如需要）

恢复旧的 render.yaml：
```bash
git revert <commit-hash>
git push
```
Render 会自动恢复旧的 8 服务架构。

然后恢复 Vercel 环境变量。

## 配额变化

| 项目 | 旧 | 新 |
|------|-----|-----|
| Pro Plan | $25.00 | $0.00 |
| 计算资源 (8→1) | $58.37 | $7.00 |
| Postgres (basic→starter) | $23.50 | $10.50 |
| Redis | $10.00 | $0.00 |
| 未使用服务 | $12.87 | $0.00 |
| **总计** | **$127.37** | **$17.50** |
