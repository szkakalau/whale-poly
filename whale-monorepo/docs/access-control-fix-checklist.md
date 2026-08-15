# 支付访问控制修复 · 部署确认清单

> **背景**：安全审计发现一条「与支付模式无关」的免费白嫖路径 —— Telegram bot 的公开 `/promote` 命令直接向 `subscriptions` 表写入 `status=active` 记录，完全绕过 Stripe。任何 Telegram 用户可反复发送 `/promote` 白嫖 7 天付费权益。
>
> 代码层面已修复，本文档用于部署前确认 + 历史数据查证/清理。

## 一、已完成的代码改动

| 文件 | 改动 |
|------|------|
| `services/telegram_bot/bot.py` | 移除 `/promote` 命令注册及其 import |
| `services/telegram_bot/handlers.py` | 删除 `promote()` 函数及因此未使用的 `timedelta` 导入 |
| `.env.example` | `PAYMENT_MODE` 默认值 `mock` → `stripe` |

## 二、部署前确认清单（逐项勾选）

- [ ] 生产环境 `PAYMENT_MODE=stripe`（已确认 ✅）
- [ ] **bot 服务已重新部署**（让 `/promote` 下线 —— 这是最关键一步）
- [ ] 部署后验证：给 bot 私聊发 `/promote`，应返回「未知命令」或不再授予订阅
- [ ] `TELEGRAM_MINIAPP_SECRET` 非空且为强随机值
- [ ] `MOBILE_AUTH_SECRET` 非空且为强随机值
- [ ] `ADMIN_TOKEN` 非空且为强随机值
- [ ] （若怀疑 `/promote` 已被外部滥用）轮换 `TELEGRAM_BOT_TOKEN`

> 注：以上 secret 为空时，会话令牌不可伪造但对应入口会失效（`auth.ts` 会在生产打 `FATAL` 日志）。部署后查一次日志确认无 `FATAL` 即可。

## 三、历史白嫖痕迹查证

**关键前提**：生产是 `stripe` 模式，所以 `mock_*` 行理论上不存在；真正要查的是 `/promote` 直接写入的记录。

### 1. 只读查证（先执行，不删数据）

```sql
-- /promote 命令产生的记录（付费权益被免费开通的唯一生产线索）
SELECT id, telegram_id, status, plan, current_period_end, stripe_subscription_id
FROM subscriptions
WHERE id LIKE 'manual_promo_%'
   OR stripe_subscription_id LIKE 'promo_sub_%'
ORDER BY current_period_end DESC;
```

- **有结果** → 说明 `/promote` 已被使用过，继续执行下方清理。
- **无结果** → 历史干净，无需清理，只需重新部署。

### 2. 清理（确认上面结果无误后再执行）

```sql
BEGIN;

-- 删除 /promote 产生的免费订阅
DELETE FROM subscriptions
WHERE id LIKE 'manual_promo_%'
   OR stripe_subscription_id LIKE 'promo_sub_%';

-- 检查影响行数是否符合预期，确认后提交
SELECT count(*) FROM subscriptions
WHERE id LIKE 'manual_promo_%'
   OR stripe_subscription_id LIKE 'promo_sub_%';   -- 应为 0

COMMIT;   -- 确认无误后提交；如有疑虑执行 ROLLBACK;
```

> ⚠️ 执行前请先对 `subscriptions` 表做备份（`pg_dump` 或 `CREATE TABLE subscriptions_backup AS SELECT * FROM subscriptions;`）。

### 3. 附：确认 mock 模式从未在生产残留

```sql
SELECT count(*) FROM subscriptions WHERE stripe_subscription_id LIKE 'mock_%';
```

- 应为 `0`。若 `> 0`，说明历史上生产曾以 `mock` 模式运行过，需要一并清理并复查该时段的数据。

## 四、根因与防线回顾

- **根因**：`/promote` 是调试/手动赠码遗留代码，被注册成公开命令且无管理员鉴权，绕过支付直接写库。
- **修复后防线**：
  - `/promote` 已删除，未来此类「手动开权限」能力应收敛到受控的 `require_admin` 端点（参照已有 `/admin/subscriptions/*`）。
  - `.env.example` 默认 `stripe`，新环境不再默认开启 mock。
- **未改动、设计合理**：bot 免费发放激活码本身没问题（「先领码后付款」），只有在 `mock` 模式下才会被利用；`stripe` 模式下 checkout 仍需真实 Stripe 支付。
