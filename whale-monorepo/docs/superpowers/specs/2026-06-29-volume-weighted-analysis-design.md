# 量价分析频道 — 设计文档

> **状态**: 已自审，待用户审核
> **日期**: 2026-06-29
> **作者**: SightWhale Team

---

## 1. 概述

### 1.1 核心理念

成交量加权价格（Volume-Weighted Price, VW）不是更好的概率估计，而是**行为偏好的探针**。价格反映边际交易者的信念（效率市场），VW 反映全体交易者的平均行为（有系统性偏差）。通过测量二者的偏离，可以探测市场情绪、冷门厌恶和聪明钱动向。

### 1.2 目标

在 SightWhale 中新增一个独立的"量价分析频道"：
- Landing 页面上展示市场量价偏离排名和走势图
- Telegram Bot 推送量价异动警报
- 形成一套基于量价偏离的独立预测评分方法论
- 与现有 Whale 追踪系统互补，提供交叉信号

### 1.3 竞品空白

当前预测市场生态中**没有**产品化的量价偏离分析工具。Polymarket Analytics、PolyStats 等仅提供原始数据展示。本功能有机会成为品类开创者。

---

## 2. 架构决策

### 2.1 方案选择：whale_engine 扩展（方案 C）

```
trade_ingest → trades_raw (DB) → whale_engine (新增 VW 定时任务)
    ↓
Postgres (market_vw_metrics + market_vw_snapshots)
    ↓
Landing (页面展示) + Telegram Bot (异动推送)
```

**理由**：
- 与现有 Whale Score 计算管道同构，复用成熟模式
- 不增加新服务，降低运维复杂度
- Python 生态适合统计计算（numpy/pandas）
- 预计算结果存入 DB，Landing 只做展示，页面加载快

### 2.2 与现有 Whale 系统的关系

两条独立信号管道，平行运行：

| 维度 | Whale 信号 | VW 信号 |
|------|-----------|---------|
| 分析对象 | 个体钱包 | 市场整体 |
| 数据源 | 鲸鱼地址的交易 | 该市场所有交易 |
| 信号类型 | 跟随聪明钱 | 探测资金共识/背离 |
| 时效性 | 实时（每笔交易） | 准实时（5分钟快照） |
| 管道 | trade_ingest → whale_engine → alert_engine → bot | whale_engine(定时) → DB → Landing/Bot |

VW 信号**不经过 alert_engine**——alert_engine 的规则引擎和冷却机制是为鲸鱼交易设计的，VW 是市场宏观指标，不需要这些。

### 2.3 交叉信号

在展示层按 `market_id` 关联两种信号，形成二维判断矩阵：

| Whale 方向 | VW 方向 | 含义 | 置信度 |
|-----------|---------|------|--------|
| 🟢 做多 | 🟢 偏多 | 聪明钱 + 资金共识 → 双重确认 | 高 |
| 🟢 做多 | 🔴 偏空 | 鲸鱼买入但散户资金背离 | 中 |
| 🔴 做空 | 🔴 偏空 | 聪明钱撤退 + 资金背离 → 双重看空 | 高 |
| 🔴 做空 | 🟢 偏多 | 鲸鱼撤退但市场仍看好 | 低 |

---

## 3. 数据模型

### 3.1 新表：`market_vw_metrics`

每个市场一行，保存最新计算值（UPSERT 更新）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `market_id` | FK → markets.id | 市场标识 |
| `total_volume_usd` | Numeric(38,2) | 窗口内总成交额 |
| `yes_volume_usd` | Numeric(38,2) | YES 方向成交额 |
| `no_volume_usd` | Numeric(38,2) | NO 方向成交额 |
| `yes_vw_price` | Numeric(10,8) | YES 量价加权均价 |
| `no_vw_price` | Numeric(10,8) | NO 量价加权均价 |
| `yes_market_price` | Numeric(10,8) | YES 当前市场价格（快照） |
| `no_market_price` | Numeric(10,8) | NO 当前市场价格（快照） |
| `vw_divergence` | Numeric(10,8) | 量价偏离度（核心指标） |
| `uai` | Numeric(10,8) | 冷门厌恶指数（Underdog Aversion Index），可为 null |
| `vw_velocity_5m` | Numeric(10,8) | 最近 5 分钟 divergence 变化速率，可为 null |
| `vw_velocity_15m` | Numeric(10,8) | 最近 15 分钟 divergence 变化速率，可为 null |
| `vw_velocity_1h` | Numeric(10,8) | 最近 1 小时 divergence 变化速率，可为 null |
| `signal_direction` | Enum('bullish','bearish','neutral') | 量价信号方向 |
| `signal_strength` | Integer(0-100) | 量价信号强度 |
| `status` | Enum('active','dormant') | 市场活跃状态 |
| `computed_at` | Timestamp | 计算时间（数据窗右边界） |

### 3.2 新表：`market_vw_snapshots`

每次计算 INSERT 一行，保留时序历史。`market_vw_metrics` 为当前最新值，此表用于画图和突变检测。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | PK 自增 | |
| `market_id` | FK → markets.id | |
| `vw_divergence` | Numeric(10,8) | 快照时偏离度 |
| `uai` | Numeric(10,8) | 快照时冷门厌恶指数 |
| `yes_vw_price` | Numeric(10,8) | 快照值 |
| `no_vw_price` | Numeric(10,8) | 快照值 |
| `yes_market_price` | Numeric(10,8) | 快照值 |
| `total_volume_usd` | Numeric(38,2) | 累计到快照时的成交额 |
| `snapshot_at` | Timestamp | 快照时间 |

### 3.3 数据保留策略

| 粒度 | 保留时长 | 说明 |
|------|---------|------|
| 5 分钟原始 | 7 天 | 原始计算粒度 |
| 小时聚合 | 30 天 | 7 天后降采样 |
| 天聚合 | 90 天 | 30 天后降采样 |

Celery Beat 每 6 小时运行 `prune_vw_snapshots()` 执行降采样和清理。

---

## 4. 核心计算公式

### 4.1 VW Price（量价加权均价）

```
VW_yes = Σ(yes_trade.amount × yes_trade.price) / Σ(yes_trade.amount)
VW_no  = Σ(no_trade.amount × no_trade.price) / Σ(no_trade.amount)
```

其中 `trade.amount` 为交易数量（outcome token 数，如 "YES 100 个"），`trade.price` 为成交价格（0-1 USD），两者乘积为 USD 价值。VW 计算窗口：**过去 7 天内**的所有交易（`WHERE trades_raw.timestamp > now() - 7d`），窗口长度在配置中可调。选择 7 天的理由：足够覆盖近期行为模式，又不会因太旧的数据拖慢计算。

### 4.2 VW Share

```
VW_yes_share  = VW_yes / (VW_yes + VW_no)
VW_no_share   = 1 - VW_yes_share
Price_yes_share = market_price_yes   （从 Polymarket CLOB 获取的最新 YES 价格）
```

### 4.3 核心指标：VW Divergence

```
divergence = VW_yes_share - Price_yes_share
```

- **正偏离**（divergence > 0）：资金比价格更看好 YES
- **负偏离**（divergence < 0）：资金不如价格看好 YES

### 4.4 冷门厌恶指数（UAI）

```
underdog = Price < 0.5 的那一侧（即市场认为概率低的一方）
UAI = VW_underdog_share / Price_underdog_share

如果 Price_underdog_share < 0.02 → UAI = null（价格过低无统计意义）
```

| UAI 区间 | 含义 | 策略含义 |
|----------|------|---------|
| < 0.3 | 极度冷门厌恶 | 冷门方可能被系统性低估 → 潜在 +EV |
| 0.3–0.6 | 中等厌恶 | 正常范围 |
| > 0.8 | 资金关注冷门 | 异常——可能有利好冷门的非公开信息 |

### 4.5 突变速率

```
velocity_5m  = (divergence_now - divergence_5min_ago) / 5
velocity_15m = (divergence_now - divergence_15min_ago) / 15
velocity_1h  = (divergence_now - divergence_1h_ago) / 60
```

前 3 个快照周期内 velocity 为 null（新市场冷启动）。

### 4.6 信号判定

```
if divergence > +0.10 → signal_direction = bullish
elif divergence < -0.10 → signal_direction = bearish
else → signal_direction = neutral

signal_strength = min(100, |divergence| × 200)
```

UAI 是独立指标，不参与 signal_direction 判定——divergence 和 UAI 各自回答不同的问题：
- divergence：资金在哪个方向？
- UAI：冷门是否被系统性回避？

### 4.7 突变判定

```
if |velocity_5m| ≥ 0.03/分钟 → 触发 "量价突变" 标记
  → signal_strength × 1.5 (capped at 100)
  → 写入 Redis 时附带 is_mutation = true
```

> 阈值（0.10, 0.03, 200 乘数）为初始假设值，需用历史数据回测校准。

---

## 5. 计算调度

### 5.1 定时任务

在 `whale_engine` 中注册 Celery Beat 定时任务：

```
compute_vw_metrics()    —— 每 5 分钟
prune_vw_snapshots()    —— 每 6 小时
```

### 5.2 compute_vw_metrics() 流程

```
1. SELECT DISTINCT market_id
   FROM trades_raw
   WHERE timestamp > now() - 10min   ← 向前多取 5min 防延迟

2. FOR EACH market:
   a. 聚合该市场过去 7 天的交易（window 可配置）：
      - SELECT outcome, SUM(amount × price), SUM(amount)
        FROM trades_raw
        WHERE market_id = ? AND timestamp > now() - INTERVAL '7 days'
        GROUP BY outcome → VW, volume

   b. 获取该市场最新 YES/NO 价格
      （从 Polymarket CLOB API 或 trades_raw 最新成交价）

   c. 计算 divergence, UAI, velocity

   d. 计算 signal_direction, signal_strength

   e. UPSERT market_vw_metrics

   f. INSERT market_vw_snapshots

   g. 检查突变条件：
      is_mutation = |velocity_5m| ≥ 0.03
      IF (is_mutation OR signal_direction 首次变化)
         AND total_volume_usd ≥ $50,000
         AND 距上次推送 > 30min
      THEN push { market_id, divergence, velocity_5m, uai,
                   signal_direction, signal_strength, is_mutation }
           TO Redis List: vw_alert_queue
```

### 5.3 市场过滤

计算前过滤：
- `markets.status != 'closed'`
- 最近 24h 该市场 `total_volume_usd ≥ $10,000`

不满足条件的市场标记为 `dormant`（休眠），不参与排名和推送，但仍可被直接查询。

### 5.4 新增 Redis 队列

```
Redis List: vw_alert_queue
消息格式: JSON { market_id, divergence, velocity_5m, uai, signal_direction,
                signal_strength, is_mutation }
```

telegram_bot worker 新增消费循环（与现有鲸鱼警报消费者并行独立运行）。

---

## 6. Landing 页面设计

### 6.1 路由

`/volume-analysis`（与 `/analyze`、`/history` 同级）

### 6.2 页面结构

```
┌─────────────────────────────────────────────┐
│  📊 量价分析                                  │
│  基于成交量加权价格的市场情绪探测               │
├─────────────────────────────────────────────┤
│  筛选: [时间窗▾] [最低量▾] [排序: 成交额▾]     │
├─────────────────────────────────────────────┤
│                                             │
│  市场列表（按总成交额降序）                      │
│                                             │
│  ┌ 市场卡片 ───────────────────────────┐    │
│  │ 市场标题                              │    │
│  │ 总成交 · YES/NO 成交量               │    │
│  │ 价格 vs VW 对比 · 偏离度%           │    │
│  │ UAI · 信号方向+强度                  │    │
│  │ [查看走势 →]                         │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 6.3 详情 Drawer

点击市场卡片后弹出侧边 Drawer（非全屏 Modal）：

**上半部分 — 量价走势图**：
- Y 轴：divergence（偏离度），标注 0 线
- X 轴：时间范围
- 绿色线：VW_yes_share（资金流向）
- 灰色线：Price_yes（市场价格）
- 竖虚线标注突变点

**下半部分 — 交叉信号**：
- 该市场 Whale 活动摘要
- Whale × VW 交叉判断 + 置信度

### 6.4 权限分级

| Tier | 列表页 | 走势图 | 详情 Drawer |
|------|--------|--------|------------|
| Free | ❌ | ❌ | ❌ |
| Pro | ✅ | ✅ | ✅ |
| Elite | ✅ | ✅ | ✅ |

走现有 plan gating 机制（`lib/plans.ts`、`auth.ts`）。

---

## 7. Telegram 推送设计

### 7.1 类型 1：量价异动警报（事件驱动）

触发条件（三者同时满足）：
1. `|velocity_5m|` ≥ 0.03/分钟
2. 市场 `total_volume_usd` ≥ $50,000
3. 距该市场上次推送 ≥ 30 分钟

消息模板：
```
🚨 量价异动 · {市场标题}

YES价格 {X}¢ → VW偏离 {±Y}%
资金在5分钟内加速涌入{方向}方向
UAI {value}（{含义}）

总成交 ${volume} | 信号强度 {strength}
查看 → [Landing链接]
```

### 7.2 类型 2：每日量价综述（定时推送）

北京时间每天早上 9:00 发送。

内容包括：
- 量价偏离 Top 3
- 冷门厌恶异常（UAI < 0.2 的市场）
- 鲸鱼 × 量价交叉信号汇总

### 7.3 推送权限

| Tier | 量价异动 | 每日综述 |
|------|---------|---------|
| Free | ❌ | ❌ |
| Pro | 实时推送 | ✅ |
| Elite | 实时 + 更低阈值 | ✅ |

### 7.4 与 Whale 推送的关系

两个推送系统**完全独立**：
- 各自有自己的冷却逻辑
- 各自的 Redis 队列
- 各自的 telegram_bot 消费 worker
- 不互相阻塞

---

## 8. 边界情况处理

| 场景 | 处理 |
|------|------|
| 极端价格（< $0.02）→ UAI 分母接近零 | `uai = null`，不参与 UAI 排名 |
| 新市场无历史快照 → velocity 无法计算 | 前 3 个周期（15min）velocity 为 null，不触发突变警报 |
| 已结算市场 | JOIN markets.status 过滤 closed，快照保留供历史查询 |
| 交易数据延迟（API 推送滞后） | 计算窗口向前多取 5 分钟（10min → last 5min），用 `computed_at` 去重 |
| 低量市场误入 | 24h 量 < $10k 降级为 dormant，不推送但在页面可见（标记"低量"） |
| 快照存储膨胀 | 5min 保留 7 天 → 小时级保留 30 天 → 天级保留 90 天 |
| 单一方向无交易（如无人买 NO） | 缺失方向 VW = null，divergence 无法计算 → 市场跳过本次周期 |

---

## 9. 测试策略

| 层级 | 内容 | 工具 |
|------|------|------|
| 单元 — VW 公式 | 模拟交易序列，断言 divergence / UAI / velocity | pytest |
| 单元 — 边界值 | 极端价格 ($0.001, $0.999)、零交易、单方向 | pytest |
| 单元 — 突变检测 | 模拟历史快照序列，断言 velocity 阈值触发 | pytest |
| 集成 — Celery 任务 | 写入测试 trades_raw → 触发 compute_vw_metrics → 检查 DB | pytest + test DB |
| 集成 — Redis 推送 | 突变触发后检查 vw_alert_queue 消息 | pytest |
| E2E — 页面渲染 | /volume-analysis 页面数据载入和展示 | vitest (Landing) |
| 手动 — 公式校准 | 30 天真实数据回测，标定阈值 | 一次性脚本 |

### 上线前校准 checklist

```
□ 取最近 30 天高量市场数据计算 VW divergence 分布
□ 标定 velocity 阈值（均值 ± 3σ 或分位数法）
□ 回测：历史上触发突变的点，之后价格是否同向移动？
□ 准确率 < 55% → 调整阈值，目标 > 60%
□ 生产上线前先在 testnet / staging 环境跑 48 小时观察
```

---

## 10. 代码落脚点

| 文件 | 操作 | 内容 |
|------|------|------|
| `services/whale_engine/vw.py` | **新建** | `compute_vw_metrics()`, `prune_vw_snapshots()` |
| `services/whale_engine/worker.py` | 修改 | 注册 Celery Beat 定时任务 |
| `shared/models/models.py` | 修改 | 新增 `MarketVwMetrics`, `MarketVwSnapshot` ORM |
| `alembic/versions/xxxx_vw_tables.py` | **新建** | Migration：创建两张新表 + signal_direction enum |
| `services/landing/src/app/volume-analysis/page.tsx` | **新建** | 量价频道页面 |
| `services/landing/src/app/volume-analysis/` 目录 | **新建** | 页面组件 + Drawer + 走势图 |
| `services/landing/src/lib/vw-signals.ts` | **新建** | DB 查询 + 交叉信号逻辑 |
| `services/telegram_bot/vw_pusher.py` | **新建** | VW 异动推送格式化 + 消费 vw_alert_queue |
| `services/telegram_bot/daily_vw_digest.py` | **新建** | 每日量价综述定时发送 |
| `alert_engine_config.yaml` | 修改 | 新增 VW 相关配置项 |

### 新增配置项（alert_engine_config.yaml）

```yaml
vw_analysis:
  computation_window_days: 7          # VW 计算滚动窗口（天）
  min_24h_volume_usd: 10000        # 市场准入最低交易量
  min_alert_volume_usd: 50000      # 触发推送最低交易量
  divergence_threshold: 0.10       # 信号判定偏离度阈值
  velocity_5m_threshold: 0.03      # 突变速率阈值 (/min)
  new_market_warmup_snapshots: 3   # 新市场预热快照数
  alert_cooldown_minutes: 30       # 同市场推送冷却
  snapshot_retention_days: 7       # 原始快照保留天数
  hourly_retention_days: 30        # 小时聚合保留天数
  daily_retention_days: 90         # 天聚合保留天数
  uai_extreme_price_threshold: 0.02  # UAI 极端价格过滤
  uai_low_threshold: 0.3           # UAI 低阈值（极度冷门厌恶）
  uai_high_threshold: 0.8          # UAI 高阈值（异常关注冷门）
```

---

## 11. 风险与开放问题

### 已识别风险

| 风险 | 缓解措施 |
|------|---------|
| VW 偏离与未来价格变动相关性不确定 | 上线前用历史数据回测，验证预测能力 |
| 低流动性市场噪声大 | 严格的 $10k 准入阈值 + dormant 降级机制 |
| 快照表数据膨胀 | 三级降采样 + 定期清理 |
| 阈值（0.10, 0.03）未经校准 | 用 30 天真实数据回测标定 |

### 已决议事项

1. **VW 计算的时间窗口**：使用**过去 7 天**滚动窗口，在 `vw_analysis.computation_window_days` 配置。选择 7 天的理由：覆盖近期行为模式，消除极旧数据的拖累，且与 Whale Score 的"7天窗口"保持一致。
2. **价格下跌趋势中的信号方向**：divergence 公式不区分趋势方向——它只看当前的 VW_yes_share 与 Price_yes 的偏差。价格下跌过程中如果出现 VW 加速偏离，位移值本身已经捕捉了方向。不需要额外的趋势修正。
3. **UAI 阈值**：< 0.3 / 0.3-0.6 / > 0.8 作为初始值写入配置，上线前用真实数据分布标定。因为是 YAML 配置项，标定后只需改配置不需改代码。

---

*设计文档结束。待审核通过后转入实现计划。*
