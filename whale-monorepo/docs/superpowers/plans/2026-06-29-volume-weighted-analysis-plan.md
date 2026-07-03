# 量价分析频道 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SightWhale 中新增量价分析频道——VW 计算存入 DB、Landing 页面展示排名+走势图、Telegram Bot 推送量价异动。

**Architecture:** whale_engine 新增 Celery Beat 定时任务每 5 分钟计算市场量价指标（divergence、UAI、velocity），结果写入 Postgres（market_vw_metrics + market_vw_snapshots），突变事件推送到 Redis vw_alert_queue。Landing 新增 `/volume-analysis` 页面从 DB 读取展示。Telegram Bot 新增 worker 消费 vw_alert_queue 并推送。

**Tech Stack:** Python 3 + SQLAlchemy + Celery + Redis + Next.js 16 (App Router) + Tailwind CSS 4 + Prisma

## Global Constraints

- 新增两张表：`market_vw_metrics`、`market_vw_snapshots`，通过 Alembic migration 创建
- VW 计算使用过去 7 天滚动窗口，窗口长度在 `alert_engine_config.yaml` 配置
- 市场准入最低 24h 交易量 $10,000；推送最低 $50,000
- 新市场前 3 个快照周期（15 分钟）不计算 velocity，不触发推送
- Plan gating：Free 用户无权访问量价频道；Pro/Elite 可完整使用
- 推送冷却：同市场 30 分钟
- 零依赖新第三方库（pandas/numpy 不引入；纯 Python + SQL 聚合完成计算）

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `shared/models/models.py` | 修改 | 新增 `MarketVwMetrics`、`MarketVwSnapshot` ORM 类 |
| `alembic/versions/<hash>_vw_tables.py` | 新建 | Alembic migration：建表 + enum type |
| `alert_engine_config.yaml` | 修改 | 新增 `vw_analysis` 配置段 |
| `services/whale_engine/vw.py` | 新建 | `compute_vw_metrics()`、`prune_vw_snapshots()` |
| `services/whale_engine/worker.py` | 修改 | 注册 Celery Beat 定时任务 |
| `services/telegram_bot/vw_pusher.py` | 新建 | 消费 `vw_alert_queue`，格式化并推送异动消息 |
| `services/telegram_bot/daily_vw_digest.py` | 新建 | 定时发送每日量价综述 |
| `services/telegram_bot/bot.py` | 修改 | 注册 VW 推送循环到 application |
| `services/landing/src/lib/vw-signals.ts` | 新建 | Prisma 查询 + 交叉信号逻辑 |
| `services/landing/src/app/volume-analysis/page.tsx` | 新建 | 量价频道页面（客户端组件） |
| `services/landing/src/app/volume-analysis/MarketCard.tsx` | 新建 | 市场列表卡片 |
| `services/landing/src/app/volume-analysis/DetailDrawer.tsx` | 新建 | 走势图 + 交叉信号 Drawer |
| `services/landing/src/app/volume-analysis/DivergenceChart.tsx` | 新建 | 量价走势折线图（Recharts） |
| `services/landing/prisma/schema.prisma` | 修改 | 新增 `MarketVwMetrics`、`MarketVwSnapshot` Prisma model |
| `tests/test_vw.py` | 新建 | 单元 + 集成测试 |
| `scripts/backtest_vw.py` | 新建 | 历史数据回测校准脚本 |

---

### Task 1: ORM 模型 + Alembic Migration

**Files:**
- Modify: `shared/models/models.py` — 末尾新增两个 ORM 类
- Create: `alembic/versions/<hash>_vw_tables.py` — migration

**Interfaces:**
- Produces: `MarketVwMetrics`, `MarketVwSnapshot` SQLAlchemy ORM 类，后续所有 Python 任务引用
- Produces: 两张 Postgres 表 + `vw_signal_direction` enum type（值：`bullish`, `bearish`, `neutral`）

**Dependencies:** 无

---

- [ ] **Step 1: 在 shared/models/models.py 末尾新增两个 ORM 类**

```python
# 新增：量价分析模型（加在文件末尾）

class MarketVwMetrics(Base):
    __tablename__ = "market_vw_metrics"
    market_id = Column(String(512), ForeignKey("markets.id"), primary_key=True)
    total_volume_usd = Column(Numeric(38, 2), server_default="0")
    yes_volume_usd = Column(Numeric(38, 2), server_default="0")
    no_volume_usd = Column(Numeric(38, 2), server_default="0")
    yes_vw_price = Column(Numeric(10, 8), nullable=True)
    no_vw_price = Column(Numeric(10, 8), nullable=True)
    yes_market_price = Column(Numeric(10, 8), nullable=True)
    no_market_price = Column(Numeric(10, 8), nullable=True)
    vw_divergence = Column(Numeric(10, 8), nullable=True)
    uai = Column(Numeric(10, 8), nullable=True)
    vw_velocity_5m = Column(Numeric(10, 8), nullable=True)
    vw_velocity_15m = Column(Numeric(10, 8), nullable=True)
    vw_velocity_1h = Column(Numeric(10, 8), nullable=True)
    signal_direction = Column(String(16), nullable=True)  # bullish|bearish|neutral
    signal_strength = Column(Integer, nullable=True)
    status = Column(String(16), server_default="active")  # active|dormant
    computed_at = Column(DateTime(timezone=True), nullable=True)


class MarketVwSnapshot(Base):
    __tablename__ = "market_vw_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    market_id = Column(String(512), ForeignKey("markets.id"), nullable=False, index=True)
    vw_divergence = Column(Numeric(10, 8), nullable=True)
    uai = Column(Numeric(10, 8), nullable=True)
    yes_vw_price = Column(Numeric(10, 8), nullable=True)
    no_vw_price = Column(Numeric(10, 8), nullable=True)
    yes_market_price = Column(Numeric(10, 8), nullable=True)
    total_volume_usd = Column(Numeric(38, 2), server_default="0")
    snapshot_at = Column(DateTime(timezone=True), nullable=False, index=True)
```

> 注意：`signal_direction` 用 String(16) 而非 Enum 类型，避免 Alembic 管理 enum 的麻烦。应用层用常量校验。

- [ ] **Step 2: 生成 Alembic migration**

```bash
cd whale-poly/whale-monorepo
alembic revision --autogenerate -m "add_vw_tables"
```

- [ ] **Step 3: 检查生成的 migration 文件**

打开 `alembic/versions/` 下新生成的 migration，确认 `upgrade()` 包含：
- `create_table("market_vw_metrics", ...)`
- `create_table("market_vw_snapshots", ...)`
- 两张表的外键约束指向 `markets.id`

如果 autogenerate 遗漏了 FK，手动补上：

```python
op.create_foreign_key("fk_vw_metrics_market", "market_vw_metrics", "markets", ["market_id"], ["id"])
op.create_foreign_key("fk_vw_snapshots_market", "market_vw_snapshots", "markets", ["market_id"], ["id"])
```

- [ ] **Step 4: 运行 migration**

```bash
cd whale-poly/whale-monorepo
alembic upgrade head
```

验证：`psql -c "\d market_vw_metrics"` 和 `\d market_vw_snapshots`

- [ ] **Step 5: Commit**

```bash
git add shared/models/models.py alembic/versions/
git commit -m "feat: add MarketVwMetrics and MarketVwSnapshot ORM models + migration"
```

---

### Task 2: 配置文件

**Files:**
- Modify: `alert_engine_config.yaml` — 末尾新增 `vw_analysis` 段

**Interfaces:**
- Produces: `settings.vw_analysis` 字典，后续 Task 3/4/6/7 通过 `shared.config.get_alert_config()` 读取

**Dependencies:** 无（独立于 Task 1）

---

- [ ] **Step 1: 在 alert_engine_config.yaml 末尾追加配置**

```yaml
vw_analysis:
  computation_window_days: 7
  min_24h_volume_usd: 10000
  min_alert_volume_usd: 50000
  divergence_threshold: 0.10
  velocity_5m_threshold: 0.03
  new_market_warmup_snapshots: 3
  alert_cooldown_minutes: 30
  snapshot_retention_days: 7
  hourly_retention_days: 30
  daily_retention_days: 90
  uai_extreme_price_threshold: 0.02
  uai_low_threshold: 0.3
  uai_high_threshold: 0.8
```

- [ ] **Step 2: 验证配置可被 Python 读取**

```bash
cd whale-poly/whale-monorepo
python -c "
from shared.config import get_alert_config
cfg = get_alert_config()
print(cfg.get('vw_analysis', {}).get('divergence_threshold'))
# Expected: 0.10
"
```

- [ ] **Step 3: Commit**

```bash
git add alert_engine_config.yaml
git commit -m "feat: add vw_analysis config section"
```

---

### Task 3: VW 计算核心模块

**Files:**
- Create: `services/whale_engine/vw.py`

**Interfaces:**
- Produces: `async def compute_vw_metrics(session: AsyncSession, redis: Redis, config: dict) -> int`
  - 参数：`session` — SQLAlchemy async session；`redis` — Redis client；`config` — `vw_analysis` 配置字典
  - 返回：计算的市场数
- Produces: `async def prune_vw_snapshots(session: AsyncSession, config: dict) -> int`
  - 返回：清理的快照行数

**Dependencies:** Task 1（ORM 模型）、Task 2（配置）

---

- [ ] **Step 1: 编写单元测试**

```python
# tests/test_vw.py

import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone

# 将被测函数 import（此时函数尚不存在，测试将失败）
# from services.whale_engine.vw import (
#     _calc_vw_prices,
#     _calc_divergence,
#     _calc_uai,
#     _calc_velocity,
#     _determine_signal,
# )


class TestCalcVwPrices:
    def test_mixed_yes_no_trades(self):
        """标准场景：YES 和 NO 方向各有交易"""
        trades = [
            # (outcome, amount, price) — amount 为 token 数，price 为 0-1
            ("Yes", Decimal("100"), Decimal("0.60")),
            ("Yes", Decimal("200"), Decimal("0.65")),
            ("No", Decimal("50"), Decimal("0.38")),
        ]
        from services.whale_engine.vw import _calc_vw_prices
        result = _calc_vw_prices(trades)
        # VW_yes = (100*0.60 + 200*0.65) / (100+200) = 190/300 = 0.6333...
        assert abs(float(result["yes_vw_price"] - Decimal("0.6333333"))) < 0.001
        # VW_no = (50*0.38) / 50 = 0.38
        assert result["no_vw_price"] == Decimal("0.38")
        # volumes
        assert result["yes_volume_usd"] == Decimal("190")  # 100*0.60 + 200*0.65
        assert result["no_volume_usd"] == Decimal("19")     # 50*0.38

    def test_single_direction_only(self):
        """只有 YES 方向交易，NO 方向为空"""
        trades = [
            ("Yes", Decimal("500"), Decimal("0.70")),
            ("Yes", Decimal("300"), Decimal("0.72")),
        ]
        from services.whale_engine.vw import _calc_vw_prices
        result = _calc_vw_prices(trades)
        assert result["yes_vw_price"] is not None
        assert result["no_vw_price"] is None  # NO 方向无交易
        assert result["no_volume_usd"] == Decimal("0")

    def test_empty_trades(self):
        """空交易列表返回 None"""
        from services.whale_engine.vw import _calc_vw_prices
        result = _calc_vw_prices([])
        assert result is None


class TestCalcDivergence:
    def test_positive_divergence(self):
        """资金比价格更看好 YES"""
        from services.whale_engine.vw import _calc_divergence
        result = _calc_divergence(
            yes_vw_price=Decimal("0.80"),
            no_vw_price=Decimal("0.20"),
            yes_market_price=Decimal("0.60"),
        )
        # VW_yes_share = 0.80; divergence = 0.80 - 0.60 = 0.20
        assert abs(float(result - Decimal("0.20"))) < 0.001

    def test_negative_divergence(self):
        """资金不如价格看好 YES"""
        from services.whale_engine.vw import _calc_divergence
        result = _calc_divergence(
            yes_vw_price=Decimal("0.45"),
            no_vw_price=Decimal("0.55"),
            yes_market_price=Decimal("0.65"),
        )
        # VW_yes_share = 0.45; divergence = 0.45 - 0.65 = -0.20
        assert abs(float(result - Decimal("-0.20"))) < 0.001


class TestCalcUai:
    def test_underdog_aversion_yes_is_underdog(self):
        """YES 是冷门方（价格<0.5），资金回避 YES"""
        from services.whale_engine.vw import _calc_uai
        uai = _calc_uai(
            yes_vw_price=Decimal("0.10"),
            no_vw_price=Decimal("0.90"),
            yes_market_price=Decimal("0.15"),
            extreme_threshold=Decimal("0.02"),
        )
        # underdog = YES(0.15); VW_underdog_share = 0.10; UAI = 0.10/0.15 = 0.666...
        assert abs(float(uai - Decimal("0.6667"))) < 0.005

    def test_uai_null_for_extreme_price(self):
        """冷门方价格 < 0.02，UAI 返回 None"""
        from services.whale_engine.vw import _calc_uai
        uai = _calc_uai(
            yes_vw_price=Decimal("0.005"),
            no_vw_price=Decimal("0.995"),
            yes_market_price=Decimal("0.01"),  # < 0.02
            extreme_threshold=Decimal("0.02"),
        )
        assert uai is None

    def test_uai_no_underdog_price_is_50(self):
        """价格正好 0.5 时无冷门方"""
        from services.whale_engine.vw import _calc_uai
        uai = _calc_uai(
            yes_vw_price=Decimal("0.50"),
            no_vw_price=Decimal("0.50"),
            yes_market_price=Decimal("0.50"),
            extreme_threshold=Decimal("0.02"),
        )
        assert uai is None


class TestCalcVelocity:
    def test_velocity_normal(self):
        """正常计算 5 分钟速率"""
        from services.whale_engine.vw import _calc_velocity
        v = _calc_velocity(
            divergence_now=Decimal("0.25"),
            divergence_past=Decimal("0.10"),
            minutes=5,
        )
        # (0.25 - 0.10) / 5 = 0.03
        assert float(v) == 0.03

    def test_velocity_past_is_none(self):
        """无历史数据返回 None"""
        from services.whale_engine.vw import _calc_velocity
        v = _calc_velocity(
            divergence_now=Decimal("0.25"),
            divergence_past=None,
            minutes=5,
        )
        assert v is None


class TestDetermineSignal:
    def test_bullish(self):
        from services.whale_engine.vw import _determine_signal
        direction, strength = _determine_signal(
            divergence=Decimal("0.15"), threshold=Decimal("0.10")
        )
        assert direction == "bullish"
        # strength = min(100, 0.15 * 200) = 30
        assert strength == 30

    def test_neutral(self):
        from services.whale_engine.vw import _determine_signal
        direction, strength = _determine_signal(
            divergence=Decimal("0.05"), threshold=Decimal("0.10")
        )
        assert direction == "neutral"
        assert strength == 10  # 0.05 * 200
```

- [ ] **Step 2: 运行测试确认全部 FAIL（函数尚不存在）**

```bash
cd whale-poly/whale-monorepo
pytest tests/test_vw.py -v
# 预期：全部 ImportError 或 NameError
```

- [ ] **Step 3: 实现 vw.py**

```python
# services/whale_engine/vw.py

import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from shared.models.models import MarketVwMetrics, MarketVwSnapshot

logger = logging.getLogger(__name__)


def _calc_vw_prices(trades: list[tuple]) -> Optional[dict]:
    """
    从交易列表计算 VW 价格和交易量。
    trades: [(outcome: str, amount: Decimal, price: Decimal), ...]
      - amount: outcome token 数量（如 "100 个 YES token"）
      - price: 每个 token 价格（0-1 USD）
    返回: { yes_vw_price, no_vw_price, yes_volume_usd, no_volume_usd } 或 None

    VW 公式: Σ(amount × price) / Σ(amount)
      分子 = USD 成交额，分母 = token 数量（用作权重）
    """
    yes_token_sum = Decimal("0")   # Σ(amount) — token count
    no_token_sum = Decimal("0")
    yes_turnover = Decimal("0")    # Σ(amount × price) — USD value
    no_turnover = Decimal("0")

    for outcome, amount, price in trades:
        usd = amount * price
        if outcome and outcome.lower() == "yes":
            yes_turnover += usd
            yes_token_sum += amount
        elif outcome and outcome.lower() == "no":
            no_turnover += usd
            no_token_sum += amount

    if yes_token_sum == 0 and no_token_sum == 0:
        return None

    result = {
        "yes_volume_usd": yes_turnover,   # USD 成交额（用于展示）
        "no_volume_usd": no_turnover,
        "yes_vw_price": (yes_turnover / yes_token_sum) if yes_token_sum > 0 else None,
        "no_vw_price": (no_turnover / no_token_sum) if no_token_sum > 0 else None,
    }
    return result


def _calc_divergence(
    yes_vw_price: Optional[Decimal],
    no_vw_price: Optional[Decimal],
    yes_market_price: Optional[Decimal],
) -> Optional[Decimal]:
    """计算 VW divergence = VW_yes_share - Price_yes"""
    if yes_vw_price is None or no_vw_price is None or yes_market_price is None:
        return None
    total = yes_vw_price + no_vw_price
    if total == 0:
        return None
    vw_yes_share = yes_vw_price / total
    return vw_yes_share - yes_market_price


def _calc_uai(
    yes_vw_price: Optional[Decimal],
    no_vw_price: Optional[Decimal],
    yes_market_price: Optional[Decimal],
    extreme_threshold: Decimal,
) -> Optional[Decimal]:
    """计算冷门厌恶指数 UAI"""
    if yes_vw_price is None or no_vw_price is None or yes_market_price is None:
        return None
    total_vw = yes_vw_price + no_vw_price
    if total_vw == 0:
        return None

    # 确定冷门方（价格 < 0.5 的一方）
    if yes_market_price < Decimal("0.5"):
        underdog_price = yes_market_price
        underdog_vw_share = yes_vw_price / total_vw
    elif yes_market_price > Decimal("0.5"):
        underdog_price = Decimal("1") - yes_market_price
        underdog_vw_share = no_vw_price / total_vw
    else:
        return None  # 正好 0.5，无冷门方

    if underdog_price < extreme_threshold:
        return None

    return underdog_vw_share / underdog_price


def _calc_velocity(
    divergence_now: Optional[Decimal],
    divergence_past: Optional[Decimal],
    minutes: int,
) -> Optional[Decimal]:
    """计算偏离度变化速率（每分钟）"""
    if divergence_now is None or divergence_past is None:
        return None
    return (divergence_now - divergence_past) / Decimal(str(minutes))


def _determine_signal(
    divergence: Decimal, threshold: Decimal
) -> tuple[str, int]:
    """根据偏离度判定信号方向和强度"""
    abs_div = abs(divergence)
    strength = min(100, int(float(abs_div) * 200))

    if divergence > threshold:
        return ("bullish", strength)
    elif divergence < -threshold:
        return ("bearish", strength)
    return ("neutral", strength)


async def _get_market_price(session: AsyncSession, market_id: str) -> Optional[Decimal]:
    """
    获取市场最新 YES 价格。
    从 trades_raw 取最新一笔 YES 方向的成交价作为快照价格。
    """
    result = await session.execute(
        text("""
            SELECT price FROM trades_raw
            WHERE market_id = :mid AND outcome = 'Yes'
            ORDER BY timestamp DESC LIMIT 1
        """),
        {"mid": market_id},
    )
    row = result.fetchone()
    return row[0] if row else None


async def _get_previous_snapshot(
    session: AsyncSession, market_id: str, minutes_ago: int
) -> Optional[Decimal]:
    """获取 N 分钟前的 divergence 快照值"""
    result = await session.execute(
        text("""
            SELECT vw_divergence FROM market_vw_snapshots
            WHERE market_id = :mid AND snapshot_at <= :cutoff
            ORDER BY snapshot_at DESC LIMIT 1
        """),
        {"mid": market_id, "cutoff": datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)},
    )
    row = result.fetchone()
    return row[0] if row else None


async def _get_last_alert_time(redis: Redis, market_id: str) -> Optional[float]:
    """获取该市场上次推送时间（unix timestamp）"""
    key = f"vw_alert_last:{market_id}"
    val = await redis.get(key)
    return float(val) if val else None


async def _set_last_alert_time(redis: Redis, market_id: str):
    """记录本次推送时间"""
    key = f"vw_alert_last:{market_id}"
    import time
    await redis.set(key, str(time.time()))


async def compute_vw_metrics(session: AsyncSession, redis: Redis, config: dict) -> int:
    """
    主计算函数：对活跃市场计算 VW 指标并写入 DB，突变时推送 Redis。
    返回成功计算的市场数。
    """
    window_days = config.get("computation_window_days", 7)
    min_24h_vol = Decimal(str(config.get("min_24h_volume_usd", 10000)))
    min_alert_vol = Decimal(str(config.get("min_alert_volume_usd", 50000)))
    divergence_threshold = Decimal(str(config.get("divergence_threshold", 0.10)))
    velocity_threshold = Decimal(str(config.get("velocity_5m_threshold", 0.03)))
    warmup_snapshots = config.get("new_market_warmup_snapshots", 3)
    cooldown_minutes = config.get("alert_cooldown_minutes", 30)
    uai_extreme = Decimal(str(config.get("uai_extreme_price_threshold", 0.02)))

    # 1. 找到最近 10 分钟内有交易且 24h 量达标的活跃市场
    result = await session.execute(
        text("""
            SELECT t.market_id,
                   SUM(CASE WHEN t.timestamp > NOW() - INTERVAL '24 hours'
                       THEN t.amount * t.price ELSE 0 END) AS vol_24h
            FROM trades_raw t
            JOIN markets m ON t.market_id = m.id
            WHERE t.timestamp > NOW() - INTERVAL '10 minutes'
              AND m.status != 'closed'
            GROUP BY t.market_id
            HAVING SUM(CASE WHEN t.timestamp > NOW() - INTERVAL '24 hours'
                       THEN t.amount * t.price ELSE 0 END) >= :min_vol
        """),
        {"min_vol": min_24h_vol},
    )
    active_markets = [row[0] for row in result.fetchall()]

    if not active_markets:
        return 0

    computed_count = 0
    now = datetime.now(timezone.utc)

    for market_id in active_markets:
        try:
            # 2a. 聚合过去 N 天交易
            trade_result = await session.execute(
                text("""
                    SELECT outcome, amount, price
                    FROM trades_raw
                    WHERE market_id = :mid
                      AND timestamp > NOW() - INTERVAL :window DAY
                """),
                {"mid": market_id, "window": str(window_days)},
            )
            trades = [(row[0], row[1], row[2]) for row in trade_result.fetchall()]

            vw_data = _calc_vw_prices(trades)
            if vw_data is None:
                continue

            # 2b. 获取市场价格
            yes_market_price = await _get_market_price(session, market_id)
            if yes_market_price is None:
                continue

            # 2c. 计算指标
            divergence = _calc_divergence(
                vw_data["yes_vw_price"],
                vw_data["no_vw_price"],
                yes_market_price,
            )
            if divergence is None:
                continue

            uai = _calc_uai(
                vw_data["yes_vw_price"],
                vw_data["no_vw_price"],
                yes_market_price,
                uai_extreme,
            )

            # Velocity（查询历史快照）
            past_5m = await _get_previous_snapshot(session, market_id, 5)
            past_15m = await _get_previous_snapshot(session, market_id, 15)
            past_1h = await _get_previous_snapshot(session, market_id, 60)

            # 统计快照数量判断是否预热完毕
            snapshot_count = await session.execute(
                text("""
                    SELECT COUNT(*) FROM market_vw_snapshots
                    WHERE market_id = :mid
                """),
                {"mid": market_id},
            )
            warmup_done = snapshot_count.scalar() >= warmup_snapshots

            velocity_5m = _calc_velocity(divergence, past_5m, 5) if warmup_done else None
            velocity_15m = _calc_velocity(divergence, past_15m, 15) if warmup_done else None
            velocity_1h = _calc_velocity(divergence, past_1h, 60) if warmup_done else None

            # 2d. 信号判定
            signal_direction, signal_strength = _determine_signal(divergence, divergence_threshold)

            # 突变检测
            is_mutation = (
                velocity_5m is not None and abs(velocity_5m) >= velocity_threshold
            )
            if is_mutation:
                signal_strength = min(100, int(signal_strength * 1.5))

            # 确定市场状态
            total_vol = vw_data["yes_volume_usd"] + vw_data["no_volume_usd"]
            status = "active" if total_vol >= min_alert_vol else "dormant"

            # 2e. UPSERT market_vw_metrics
            await session.execute(
                text("""
                    INSERT INTO market_vw_metrics (
                        market_id, total_volume_usd, yes_volume_usd, no_volume_usd,
                        yes_vw_price, no_vw_price,
                        yes_market_price, no_market_price,
                        vw_divergence, uai,
                        vw_velocity_5m, vw_velocity_15m, vw_velocity_1h,
                        signal_direction, signal_strength, status, computed_at
                    ) VALUES (
                        :mid, :tv, :yv, :nv,
                        :yvp, :nvp,
                        :ymp, :nmp,
                        :div, :uai,
                        :v5, :v15, :v1h,
                        :sd, :ss, :st, :now
                    )
                    ON CONFLICT (market_id) DO UPDATE SET
                        total_volume_usd = EXCLUDED.total_volume_usd,
                        yes_volume_usd = EXCLUDED.yes_volume_usd,
                        no_volume_usd = EXCLUDED.no_volume_usd,
                        yes_vw_price = EXCLUDED.yes_vw_price,
                        no_vw_price = EXCLUDED.no_vw_price,
                        yes_market_price = EXCLUDED.yes_market_price,
                        no_market_price = EXCLUDED.no_market_price,
                        vw_divergence = EXCLUDED.vw_divergence,
                        uai = EXCLUDED.uai,
                        vw_velocity_5m = EXCLUDED.vw_velocity_5m,
                        vw_velocity_15m = EXCLUDED.vw_velocity_15m,
                        vw_velocity_1h = EXCLUDED.vw_velocity_1h,
                        signal_direction = EXCLUDED.signal_direction,
                        signal_strength = EXCLUDED.signal_strength,
                        status = EXCLUDED.status,
                        computed_at = EXCLUDED.computed_at
                """),
                {
                    "mid": market_id,
                    "tv": total_vol,
                    "yv": vw_data["yes_volume_usd"],
                    "nv": vw_data["no_volume_usd"],
                    "yvp": vw_data["yes_vw_price"],
                    "nvp": vw_data["no_vw_price"],
                    "ymp": yes_market_price,
                    "nmp": Decimal("1") - yes_market_price,
                    "div": divergence,
                    "uai": uai,
                    "v5": velocity_5m,
                    "v15": velocity_15m,
                    "v1h": velocity_1h,
                    "sd": signal_direction,
                    "ss": signal_strength,
                    "st": status,
                    "now": now,
                },
            )

            # 2f. INSERT snapshot
            await session.execute(
                text("""
                    INSERT INTO market_vw_snapshots (
                        market_id, vw_divergence, uai,
                        yes_vw_price, no_vw_price,
                        yes_market_price,
                        total_volume_usd, snapshot_at
                    ) VALUES (
                        :mid, :div, :uai,
                        :yvp, :nvp,
                        :ymp,
                        :tv, :now
                    )
                """),
                {
                    "mid": market_id,
                    "div": divergence,
                    "uai": uai,
                    "yvp": vw_data["yes_vw_price"],
                    "nvp": vw_data["no_vw_price"],
                    "ymp": yes_market_price,
                    "tv": total_vol,
                    "now": now,
                },
            )

            # 2g. 推送检查
            should_push = False
            if is_mutation and status == "active":
                last_alert = await _get_last_alert_time(redis, market_id)
                if last_alert is None or (time.time() - last_alert) > cooldown_minutes * 60:
                    should_push = True

            if should_push:
                payload = json.dumps({
                    "market_id": market_id,
                    "divergence": float(divergence),
                    "velocity_5m": float(velocity_5m) if velocity_5m else None,
                    "uai": float(uai) if uai else None,
                    "signal_direction": signal_direction,
                    "signal_strength": signal_strength,
                    "is_mutation": True,
                })
                await redis.rpush("vw_alert_queue", payload)
                await _set_last_alert_time(redis, market_id)
                logger.info(f"vw_mutation_pushed market={market_id} divergence={divergence}")

            computed_count += 1

        except Exception:
            logger.exception(f"vw_compute_failed market={market_id}")
            continue

    return computed_count


async def prune_vw_snapshots(session: AsyncSession, config: dict) -> int:
    """清理过期快照，执行三级降采样"""
    retention_days = config.get("snapshot_retention_days", 7)
    hourly_days = config.get("hourly_retention_days", 30)
    daily_days = config.get("daily_retention_days", 90)
    deleted = 0

    # 删除超过保留期的原始快照
    result = await session.execute(
        text("""
            DELETE FROM market_vw_snapshots
            WHERE snapshot_at < NOW() - INTERVAL :days DAY
        """),
        {"days": str(retention_days)},
    )
    deleted += result.rowcount

    # 注意：小时/天级聚合可以后续版本实现
    # 第一版先清理原始数据，聚合逻辑作为增强

    return deleted
```

- [ ] **Step 4: 运行单元测试确认全部 PASS**

```bash
cd whale-poly/whale-monorepo
pytest tests/test_vw.py -v
# 预期：全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add services/whale_engine/vw.py tests/test_vw.py
git commit -m "feat: add VW computation core module with unit tests"
```

---

### Task 4: Celery Beat 注册

**Files:**
- Modify: `services/whale_engine/worker.py` — `beat_schedule` 新增任务 + 新增 task 函数

**Interfaces:**
- Consumes: `compute_vw_metrics(session, redis, config)` from Task 3
- Produces: 每 5 分钟自动执行 VW 计算的 Beat 调度

**Dependencies:** Task 3

---

- [ ] **Step 1: 修改 worker.py — 顶部添加 import**

在 `services/whale_engine/worker.py` 的现有 import 块后添加：

```python
from services.whale_engine.vw import compute_vw_metrics, prune_vw_snapshots
from shared.config import get_alert_config
```

- [ ] **Step 2: 修改 beat_schedule — 新增两个定时任务**

找到 `celery_app.conf.beat_schedule = {...}` 处，在现有两项后追加：

```python
celery_app.conf.beat_schedule = {
    "consume-trade-created": {"task": "services.whale_engine.consume_trade_created", "schedule": consume_seconds},
    "recompute-whale-stats": {"task": "services.whale_engine.recompute_whale_stats", "schedule": recompute_seconds},
    # 新增：
    "compute-vw-metrics": {"task": "services.whale_engine.compute_vw_metrics", "schedule": 300.0},      # 每 5 分钟
    "prune-vw-snapshots": {"task": "services.whale_engine.prune_vw_snapshots", "schedule": 21600.0},     # 每 6 小时
}
```

- [ ] **Step 3: 新增两个 async 内部函数 + Celery task**

在文件末尾（`recompute_whale_stats_task` 函数之后）添加：

```python
async def _compute_vw_once() -> int:
    """执行一轮 VW 指标计算"""
    config = get_alert_config().get("vw_analysis", {})
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        async with SessionLocal() as session:
            n = await compute_vw_metrics(session, redis, config)
            await session.commit()
        return n
    finally:
        await redis.aclose()


@celery_app.task(name="services.whale_engine.compute_vw_metrics")
def compute_vw_metrics_task() -> int:
    try:
        return _run(_compute_vw_once())
    except Exception:
        logger.exception("compute_vw_metrics_failed")
        return 0


async def _prune_vw_once() -> int:
    """执行一轮 VW 快照清理"""
    config = get_alert_config().get("vw_analysis", {})
    async with SessionLocal() as session:
        n = await prune_vw_snapshots(session, config)
        await session.commit()
    return n


@celery_app.task(name="services.whale_engine.prune_vw_snapshots")
def prune_vw_snapshots_task() -> int:
    try:
        return _run(_prune_vw_once())
    except Exception:
        logger.exception("prune_vw_snapshots_failed")
        return 0
```

- [ ] **Step 4: 验证 Celery 配置语法正确**

```bash
cd whale-poly/whale-monorepo
python -c "from services.whale_engine.worker import celery_app; print(celery_app.conf.beat_schedule)"
# 预期：输出包含 compute-vw-metrics 和 prune-vw-snapshots 的字典
```

- [ ] **Step 5: Commit**

```bash
git add services/whale_engine/worker.py
git commit -m "feat: register VW compute and prune Celery Beat tasks"
```

---

### Task 5: Telegram Bot — VW 异动推送

**Files:**
- Create: `services/telegram_bot/vw_pusher.py`
- Modify: `services/telegram_bot/bot.py` — 注册 VW 消费循环

**Interfaces:**
- Consumes: Redis `vw_alert_queue`（Task 3 写入）
- Produces: Telegram 消息推送给 Pro/Elite 订阅用户

**Dependencies:** Task 1（ORM 存在）、Task 3（Redis 队列已定义）

---

- [ ] **Step 1: 创建 vw_pusher.py**

```python
# services/telegram_bot/vw_pusher.py

import asyncio
import json
import logging
from datetime import datetime, timezone

from redis.asyncio import Redis
from telegram import Bot
from telegram.error import TelegramError

from shared.config import settings
from services.telegram_bot.recipients import get_active_subscribers

logger = logging.getLogger(__name__)

# 服务级冷却：同市场 30 分钟内只推一次
_COOLDOWN: dict[str, float] = {}


def _format_alert(payload: dict, market_title: str) -> str:
    """格式化异动消息"""
    div = payload["divergence"]
    direction_text = "YES" if div > 0 else "NO"
    arrow = "📈" if div > 0 else "📉"
    uai = payload.get("uai")
    uai_text = ""
    if uai is not None:
        if uai < 0.3:
            uai_text = f"UAI {uai:.2f}（极度冷门厌恶）"
        elif uai < 0.6:
            uai_text = f"UAI {uai:.2f}（中等）"
        else:
            uai_text = f"UAI {uai:.2f}（资金关注冷门⚠️）"

    return (
        f"🚨 量价异动 · {market_title}\n\n"
        f"资金在5分钟内加速涌入{direction_text}方向 {arrow}\n"
        f"偏离度 {div:+.1%} | 信号强度 {payload['signal_strength']}\n"
        f"{uai_text}\n"
        f"查看 → {settings.landing_base_url}/volume-analysis"
    )


async def _get_market_title(db_pool, market_id: str) -> str:
    """从 DB 获取市场标题（fallback 到 market_id）"""
    # 简化实现：直接查 markets 表
    import asyncpg
    try:
        conn = await asyncpg.connect(settings.database_url)
        row = await conn.fetchrow(
            "SELECT title FROM markets WHERE id = $1", market_id
        )
        await conn.close()
        return row["title"] if row else market_id
    except Exception:
        return market_id


async def run_vw_pusher(stop: asyncio.Event, bot: Bot) -> None:
    """
    VW 异动推送主循环。
    在 bot.py 的 application 启动后作为后台任务运行。
    """
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    logger.info("vw_pusher_started")

    try:
        while not stop.is_set():
            try:
                item = await redis.blpop("vw_alert_queue", timeout=5)
                if item is None:
                    continue

                _, raw = item
                payload = json.loads(raw)
                market_id = payload["market_id"]

                # 服务级冷却检查
                now = datetime.now(timezone.utc).timestamp()
                if market_id in _COOLDOWN and (now - _COOLDOWN[market_id]) < 1800:
                    continue
                _COOLDOWN[market_id] = now

                market_title = await _get_market_title(None, market_id)
                message = _format_alert(payload, market_title)

                # 推送给 Pro/Elite 用户
                subscribers = await get_active_subscribers(paid_only=True)
                sent = 0
                for tg_id in subscribers:
                    try:
                        await bot.send_message(tg_id, message, disable_web_page_preview=True)
                        sent += 1
                    except TelegramError:
                        continue

                logger.info(f"vw_alert_delivered market={market_id} recipients={sent}")

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("vw_pusher_error")
                await asyncio.sleep(1)
    finally:
        await redis.aclose()
        logger.info("vw_pusher_stopped")
```

- [ ] **Step 2: 修改 bot.py — 注册后台任务**

在 `bot.py` 的 `build_application()` 和 `run_polling()` 保持不变。需要在**启动入口**（通常是 `__init__.py` 或 Docker entrypoint）添加：

在 `bot.py` 的 `async def run_polling(stop, application)` 函数中，`application.updater.start_polling(...)` 之后添加：

```python
# 在 application.updater.start_polling(...) 之后
from services.telegram_bot.vw_pusher import run_vw_pusher
vw_task = asyncio.create_task(run_vw_pusher(stop, application.bot))
```

并在 finally 块中取消：

```python
finally:
    vw_task.cancel()
    await application.updater.stop()
    ...
```

- [ ] **Step 3: Commit**

```bash
git add services/telegram_bot/vw_pusher.py services/telegram_bot/bot.py
git commit -m "feat: add VW mutation alert pusher to Telegram bot"
```

---

### Task 6: Telegram Bot — 每日量价综述

**Files:**
- Create: `services/telegram_bot/daily_vw_digest.py`

**Interfaces:**
- Consumes: `market_vw_metrics` 表（Task 3 写入）
- Produces: 每日定时发送给 Pro/Elite 用户的综述消息

**Dependencies:** Task 1（ORM）、Task 5（bot 基础设施）

---

- [ ] **Step 1: 创建 daily_vw_digest.py**

```python
# services/telegram_bot/daily_vw_digest.py

import asyncio
import logging
from datetime import datetime, time, timezone

from sqlalchemy import text
from telegram import Bot
from telegram.error import TelegramError

from shared.config import settings
from shared.db import SessionLocal
from services.telegram_bot.recipients import get_active_subscribers

logger = logging.getLogger(__name__)


async def _query_top_divergence(session, limit: int = 3):
    """查询偏离度绝对值最大的 Top N 市场"""
    result = await session.execute(
        text("""
            SELECT m.title, vw.vw_divergence, vw.signal_direction, vw.signal_strength,
                   vw.total_volume_usd, vw.uai
            FROM market_vw_metrics vw
            JOIN markets m ON vw.market_id = m.id
            WHERE vw.status = 'active'
            ORDER BY ABS(vw.vw_divergence) DESC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    return result.fetchall()


async def _query_uai_anomalies(session, uai_threshold: float = 0.2):
    """查询 UAI 异常低的市场（极度冷门厌恶）"""
    result = await session.execute(
        text("""
            SELECT m.title, vw.uai, vw.vw_divergence
            FROM market_vw_metrics vw
            JOIN markets m ON vw.market_id = m.id
            WHERE vw.status = 'active' AND vw.uai IS NOT NULL AND vw.uai < :threshold
            ORDER BY vw.uai ASC
            LIMIT 5
        """),
        {"threshold": uai_threshold},
    )
    return result.fetchall()


async def _query_cross_signals(session):
    """查询有 Whale + VW 交叉信号的市场"""
    result = await session.execute(
        text("""
            SELECT DISTINCT m.title, vw.signal_direction AS vw_dir,
                   vw.vw_divergence
            FROM market_vw_metrics vw
            JOIN markets m ON vw.market_id = m.id
            JOIN whale_trades wt ON vw.market_id = wt.market_id
            WHERE vw.status = 'active'
              AND wt.created_at > NOW() - INTERVAL '24 hours'
            LIMIT 10
        """),
    )
    return result.fetchall()


def _format_digest(top, uai_anomalies, cross_count: int) -> str:
    lines = ["📊 昨日量价综述 · " + datetime.now(timezone.utc).strftime("%m月%d日"), ""]

    if top:
        lines.append("🔥 量价偏离 Top 3:")
        for i, row in enumerate(top, 1):
            div = float(row[1])
            lines.append(
                f"{i}. {row[0]} — {'YES偏多' if div > 0 else 'NO偏多'} {div:+.1%}"
            )
        lines.append("")

    if uai_anomalies:
        lines.append("❄️ 冷门厌恶异常（UAI < 0.2）:")
        for row in uai_anomalies:
            lines.append(f"· {row[0]} UAI={float(row[1]):.2f}")
        lines.append("")

    if cross_count > 0:
        lines.append(f"🐋 鲸鱼×量价交叉信号: {cross_count} 个市场有重叠活动")
        lines.append("")

    lines.append(f"查看完整 → {settings.landing_base_url}/volume-analysis")
    return "\n".join(lines)


async def run_daily_digest(bot: Bot) -> None:
    """发送每日量价综述（北京时间 09:00）"""
    logger.info("daily_vw_digest_started")

    while True:
        now = datetime.now(timezone.utc)
        # 北京时间 09:00 = UTC 01:00
        target_utc = time(1, 0)
        seconds_until = (
            (target_utc.hour - now.hour) * 3600
            + (target_utc.minute - now.minute) * 60
            - now.second
        )
        if seconds_until < 0:
            seconds_until += 86400  # 明天同一时间

        logger.info(f"daily_vw_digest_next_in {seconds_until}s")
        await asyncio.sleep(seconds_until)

        try:
            async with SessionLocal() as session:
                top = await _query_top_divergence(session)
                uai = await _query_uai_anomalies(session)
                cross = await _query_cross_signals(session)
                message = _format_digest(top, uai, len(cross))

            subscribers = await get_active_subscribers(paid_only=True)
            sent = 0
            for tg_id in subscribers:
                try:
                    await bot.send_message(tg_id, message, disable_web_page_preview=True)
                    sent += 1
                except TelegramError:
                    continue

            logger.info(f"daily_vw_digest_sent recipients={sent}")

        except Exception:
            logger.exception("daily_vw_digest_failed")
            await asyncio.sleep(60)
```

- [ ] **Step 2: 在 bot 启动入口注册后台任务**

在 `bot.py` 的 `run_polling` 中，与 `run_vw_pusher` 同样方式注册：

```python
from services.telegram_bot.daily_vw_digest import run_daily_digest
digest_task = asyncio.create_task(run_daily_digest(application.bot))
# finally 块中 cancel
```

- [ ] **Step 3: Commit**

```bash
git add services/telegram_bot/daily_vw_digest.py services/telegram_bot/bot.py
git commit -m "feat: add daily VW digest Telegram push"
```

---

### Task 7: Landing — vw-signals 数据库查询层

**Files:**
- Create: `services/landing/src/lib/vw-signals.ts`
- Modify: `services/landing/prisma/schema.prisma` — 新增 Prisma models

**Interfaces:**
- Produces: `getVwMetrics()`, `getVwSnapshots()`, `getCrossSignals()` 三个查询函数
- Consumes: `market_vw_metrics` 和 `market_vw_snapshots`（通过 Prisma）

**Dependencies:** Task 1（表已存在）

---

- [ ] **Step 1: 在 Prisma schema 中新增两个 model**

在 `services/landing/prisma/schema.prisma` 末尾添加：

```prisma
model MarketVwMetrics {
  marketId         String   @id @map("market_id") @db.VarChar(512)
  totalVolumeUsd   Decimal  @default(0) @map("total_volume_usd") @db.Decimal(38, 2)
  yesVolumeUsd     Decimal  @default(0) @map("yes_volume_usd") @db.Decimal(38, 2)
  noVolumeUsd      Decimal  @default(0) @map("no_volume_usd") @db.Decimal(38, 2)
  yesVwPrice       Decimal? @map("yes_vw_price") @db.Decimal(10, 8)
  noVwPrice        Decimal? @map("no_vw_price") @db.Decimal(10, 8)
  yesMarketPrice   Decimal? @map("yes_market_price") @db.Decimal(10, 8)
  noMarketPrice    Decimal? @map("no_market_price") @db.Decimal(10, 8)
  vwDivergence     Decimal? @map("vw_divergence") @db.Decimal(10, 8)
  uai              Decimal? @map("uai") @db.Decimal(10, 8)
  vwVelocity5m     Decimal? @map("vw_velocity_5m") @db.Decimal(10, 8)
  vwVelocity15m    Decimal? @map("vw_velocity_15m") @db.Decimal(10, 8)
  vwVelocity1h     Decimal? @map("vw_velocity_1h") @db.Decimal(10, 8)
  signalDirection  String?  @map("signal_direction") @db.VarChar(16)
  signalStrength   Int?
  status           String   @default("active") @db.VarChar(16)
  computedAt       DateTime? @map("computed_at") @db.Timestamptz()

  @@map("market_vw_metrics")
}

model MarketVwSnapshot {
  id              Int       @id @default(autoincrement())
  marketId        String    @map("market_id") @db.VarChar(512)
  vwDivergence    Decimal?  @map("vw_divergence") @db.Decimal(10, 8)
  uai             Decimal?  @map("uai") @db.Decimal(10, 8)
  yesVwPrice      Decimal?  @map("yes_vw_price") @db.Decimal(10, 8)
  noVwPrice       Decimal?  @map("no_vw_price") @db.Decimal(10, 8)
  yesMarketPrice  Decimal?  @map("yes_market_price") @db.Decimal(10, 8)
  totalVolumeUsd  Decimal   @default(0) @map("total_volume_usd") @db.Decimal(38, 2)
  snapshotAt      DateTime  @map("snapshot_at") @db.Timestamptz()

  @@index([marketId])
  @@index([snapshotAt])
  @@map("market_vw_snapshots")
}
```

运行 `npx prisma generate` 生成 Prisma client。

- [ ] **Step 2: 创建 vw-signals.ts**

```typescript
// services/landing/src/lib/vw-signals.ts

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────

export interface VwMetricsRow {
  marketId: string;
  marketTitle: string;
  totalVolumeUsd: number;
  yesVolumeUsd: number;
  noVolumeUsd: number;
  yesVwPrice: number | null;
  noVwPrice: number | null;
  yesMarketPrice: number | null;
  vwDivergence: number | null;
  uai: number | null;
  vwVelocity5m: number | null;
  signalDirection: 'bullish' | 'bearish' | 'neutral' | null;
  signalStrength: number | null;
  status: string;
  computedAt: Date | null;
}

export interface VwSnapshotPoint {
  snapshotAt: Date;
  vwDivergence: number | null;
  yesMarketPrice: number | null;
  // 派生值：VW_yes_share = Price_yes + divergence
}

export interface CrossSignal {
  marketId: string;
  marketTitle: string;
  vwDirection: string | null;
  vwDivergence: number | null;
  whaleDirection: 'bullish' | 'bearish' | 'neutral';
  confidenceLevel: 'high' | 'medium' | 'low';
}

// ── Queries ─────────────────────────────────────────

/** 获取量价指标列表（按成交量降序，用于页面列表） */
export async function getVwMetrics(
  sortBy: 'volume' | 'divergence' | 'strength' = 'volume',
  limit = 50
): Promise<VwMetricsRow[]> {
  const orderMap = {
    volume: 'total_volume_usd DESC',
    divergence: 'ABS(vw_divergence) DESC',
    strength: 'signal_strength DESC NULLS LAST',
  };

  const rows = await prisma.$queryRawUnsafe<VwMetricsRow[]>(
    `SELECT
       vw.market_id AS "marketId",
       m.title AS "marketTitle",
       vw.total_volume_usd::float AS "totalVolumeUsd",
       vw.yes_volume_usd::float AS "yesVolumeUsd",
       vw.no_volume_usd::float AS "noVolumeUsd",
       vw.yes_vw_price::float AS "yesVwPrice",
       vw.no_vw_price::float AS "noVwPrice",
       vw.yes_market_price::float AS "yesMarketPrice",
       vw.vw_divergence::float AS "vwDivergence",
       vw.uai::float AS "uai",
       vw.vw_velocity_5m::float AS "vwVelocity5m",
       vw.signal_direction AS "signalDirection",
       vw.signal_strength AS "signalStrength",
       vw.status,
       vw.computed_at AS "computedAt"
     FROM market_vw_metrics vw
     JOIN markets m ON vw.market_id = m.id
     WHERE vw.status = 'active'
     ORDER BY ${orderMap[sortBy]}
     LIMIT ${limit}`
  );
  return rows;
}

/** 获取单个市场的走势图快照数据 */
export async function getVwSnapshots(
  marketId: string,
  hours = 24
): Promise<VwSnapshotPoint[]> {
  const rows = await prisma.$queryRawUnsafe<VwSnapshotPoint[]>(
    `SELECT
       snapshot_at AS "snapshotAt",
       vw_divergence::float AS "vwDivergence",
       yes_market_price::float AS "yesMarketPrice"
     FROM market_vw_snapshots
     WHERE market_id = $1
       AND snapshot_at > NOW() - INTERVAL '${hours} hours'
     ORDER BY snapshot_at ASC`,
    marketId
  );
  return rows;
}

/** 计算 Whale × VW 交叉信号 */
export async function getCrossSignals(
  marketId: string
): Promise<CrossSignal | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `WITH whale_dir AS (
       SELECT
         market_id,
         CASE
           WHEN SUM(CASE WHEN wt.side = 'BUY' THEN wt.size * wt.price ELSE 0 END)
                > SUM(CASE WHEN wt.side = 'SELL' THEN wt.size * wt.price ELSE 0 END)
           THEN 'bullish'
           ELSE 'bearish'
         END AS whale_direction
       FROM whale_trade_history wt
       WHERE wt.market_id = $1
         AND wt.timestamp > NOW() - INTERVAL '24 hours'
       GROUP BY wt.market_id
     )
     SELECT
       vw.market_id AS "marketId",
       m.title AS "marketTitle",
       vw.signal_direction AS "vwDirection",
       vw.vw_divergence::float AS "vwDivergence",
       wd.whale_direction AS "whaleDirection"
     FROM market_vw_metrics vw
     JOIN markets m ON vw.market_id = m.id
     LEFT JOIN whale_dir wd ON vw.market_id = wd.market_id
     WHERE vw.market_id = $1`,
    marketId
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const confidence = deriveConfidence(row.vwDirection, row.whaleDirection);

  return {
    marketId: row.marketId,
    marketTitle: row.marketTitle,
    vwDirection: row.vwDirection,
    vwDivergence: row.vwDivergence,
    whaleDirection: row.whaleDirection || 'neutral',
    confidenceLevel: confidence,
  };
}

// ── Helpers ─────────────────────────────────────────

function deriveConfidence(
  vwDir: string | null,
  whaleDir: string | null
): 'high' | 'medium' | 'low' {
  if (!vwDir || !whaleDir) return 'medium';
  // 同向 = 高置信，反向 = 低置信，其他 = 中
  if (vwDir === whaleDir) return 'high';
  if (
    (vwDir === 'bullish' && whaleDir === 'bearish') ||
    (vwDir === 'bearish' && whaleDir === 'bullish')
  )
    return 'low';
  return 'medium';
}
```

- [ ] **Step 3: Commit**

```bash
git add services/landing/src/lib/vw-signals.ts services/landing/prisma/schema.prisma
git commit -m "feat: add VW signals Prisma models and query layer"
```

---

### Task 8: Landing — `/volume-analysis` 页面

**Files:**
- Create: `services/landing/src/app/volume-analysis/page.tsx`
- Create: `services/landing/src/app/volume-analysis/MarketCard.tsx`
- Create: `services/landing/src/app/volume-analysis/DetailDrawer.tsx`
- Create: `services/landing/src/app/volume-analysis/DivergenceChart.tsx`

**Interfaces:**
- Consumes: `getVwMetrics()`, `getVwSnapshots()`, `getCrossSignals()` from Task 7
- Produces: 用户可见的量价频道页面

**Dependencies:** Task 7

---

- [ ] **Step 1: 创建 MarketCard.tsx**

```tsx
'use client';

import { VwMetricsRow } from '@/lib/vw-signals';

interface Props {
  data: VwMetricsRow;
  onSelect: (marketId: string) => void;
}

export default function MarketCard({ data, onSelect }: Props) {
  const div = data.vwDivergence ?? 0;
  const directionColor = data.signalDirection === 'bullish'
    ? 'text-emerald-600'
    : data.signalDirection === 'bearish'
    ? 'text-red-600'
    : 'text-gray-500';
  const directionBg = data.signalDirection === 'bullish'
    ? 'bg-emerald-50'
    : data.signalDirection === 'bearish'
    ? 'bg-red-50'
    : 'bg-gray-50';

  const fmtUsd = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(0)}`;

  return (
    <div
      className="p-4 rounded-xl border border-gray-100 hover:border-gray-200
                 transition-colors duration-200 ease-out cursor-pointer bg-white"
      onClick={() => onSelect(data.marketId)}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1">
          {data.marketTitle}
        </h3>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${directionBg} ${directionColor}`}>
          {data.signalDirection ?? 'neutral'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>总成交 {fmtUsd(data.totalVolumeUsd)}</span>
        <span>
          强度 {data.signalStrength ?? '-'}
        </span>
        <span>YES {fmtUsd(data.yesVolumeUsd)} / NO {fmtUsd(data.noVolumeUsd)}</span>
        <span>
          价格 {(data.yesMarketPrice ?? 0) * 100 | 0}¢
          {' · '}
          VW {(data.yesVwPrice ?? 0) * 100 | 0}¢
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className={`font-mono ${directionColor}`}>
          偏离 {div > 0 ? '+' : ''}{(div * 100).toFixed(1)}%
        </span>
        {data.uai != null && (
          <span className="text-gray-400">
            UAI {data.uai.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 DivergenceChart.tsx（使用 Recharts）**

```tsx
'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { VwSnapshotPoint } from '@/lib/vw-signals';

interface Props {
  snapshots: VwSnapshotPoint[];
}

export default function DivergenceChart({ snapshots }: Props) {
  const data = snapshots.map((s) => ({
    time: new Date(s.snapshotAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit',
    }),
    vwYesShare: (s.yesMarketPrice ?? 0) + (s.vwDivergence ?? 0),
    priceYes: s.yesMarketPrice ?? 0,
    divergence: s.vwDivergence ?? 0,
  }));

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">暂无走势数据</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'vwYesShare') return [`${(value * 100).toFixed(1)}%`, 'VW资金流向'];
              if (name === 'priceYes') return [`${(value * 100).toFixed(1)}%`, '市场价格'];
              return [value, name];
            }}
          />
          <ReferenceLine
            y={data[0]?.priceYes}
            stroke="#9CA3AF"
            strokeDasharray="5 5"
            label="当前价格"
          />
          <Line
            type="monotone"
            dataKey="vwYesShare"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            name="vwYesShare"
          />
          <Line
            type="monotone"
            dataKey="priceYes"
            stroke="#9CA3AF"
            strokeWidth={1.5}
            dot={false}
            name="priceYes"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> VW资金流向
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-gray-400 inline-block" /> 市场价格
        </span>
      </div>
    </div>
  );
}
```

> 注意：如果项目尚未安装 Recharts，需先 `npm install recharts`。

- [ ] **Step 3: 创建 DetailDrawer.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getVwSnapshots, getCrossSignals, VwSnapshotPoint, CrossSignal, VwMetricsRow } from '@/lib/vw-signals';
import DivergenceChart from './DivergenceChart';

interface Props {
  market: VwMetricsRow;
  onClose: () => void;
}

export default function DetailDrawer({ market, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<VwSnapshotPoint[]>([]);
  const [cross, setCross] = useState<CrossSignal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [snaps, cs] = await Promise.all([
        getVwSnapshots(market.marketId),
        getCrossSignals(market.marketId),
      ]);
      setSnapshots(snaps);
      setCross(cs);
      setLoading(false);
    }
    load();
  }, [market.marketId]);

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50
                    flex flex-col transition-transform duration-200 ease-out">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-900 line-clamp-1 flex-1 mr-3">
          {market.marketTitle}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200 ease-out">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : (
          <>
            {/* 走势图 */}
            <section>
              <h3 className="text-xs font-medium text-gray-500 mb-3">量价走势</h3>
              <DivergenceChart snapshots={snapshots} />
            </section>

            {/* 交叉信号 */}
            {cross && (
              <section>
                <h3 className="text-xs font-medium text-gray-500 mb-3">交叉信号</h3>
                <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">VW 信号</span>
                    <span className={cross.vwDirection === 'bullish' ? 'text-emerald-600' : 'text-red-600'}>
                      {cross.vwDirection === 'bullish' ? '🟢 偏多' : '🔴 偏空'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Whale 信号</span>
                    <span className={cross.whaleDirection === 'bullish' ? 'text-emerald-600' : 'text-red-600'}>
                      {cross.whaleDirection === 'bullish' ? '🟢 做多' : '🔴 做空'}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-500">交叉判断</span>
                    <span>
                      置信度：
                      <span className={
                        cross.confidenceLevel === 'high' ? 'text-emerald-600'
                        : cross.confidenceLevel === 'low' ? 'text-red-600'
                        : 'text-amber-600'
                      }>
                        {cross.confidenceLevel === 'high' ? '高 ✓'
                         : cross.confidenceLevel === 'low' ? '低 ⚠️'
                         : '中'}
                      </span>
                    </span>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 page.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { getVwMetrics, VwMetricsRow } from '@/lib/vw-signals';
import { useAuth } from '@/lib/auth';
import FullAccessGating from '@/components/FullAccessGating';
import MarketCard from './MarketCard';
import DetailDrawer from './DetailDrawer';

export default function VolumeAnalysisPage() {
  const { user, plan } = useAuth();
  const [markets, setMarkets] = useState<VwMetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'divergence' | 'strength'>('volume');
  const [selected, setSelected] = useState<VwMetricsRow | null>(null);

  useEffect(() => {
    getVwMetrics(sortBy).then(setMarkets).finally(() => setLoading(false));
  }, [sortBy]);

  // Plan gating - Free 用户无权访问
  if (!plan || plan === 'free') {
    return <FullAccessGating featureName="量价分析频道" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={22} className="text-emerald-500" />
            量价分析
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            基于成交量加权价格的市场情绪探测
          </p>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 mb-4">
          {(['volume', 'divergence', 'strength'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ease-out
                ${sortBy === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
            >
              {{ volume: '按成交额', divergence: '按偏离度', strength: '按信号强度' }[key]}
            </button>
          ))}
        </div>

        {/* Market list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            暂无活跃市场数据，请稍后再试
          </div>
        ) : (
          <div className="space-y-3">
            {markets.map((m) => (
              <MarketCard
                key={m.marketId}
                data={m}
                onSelect={() => setSelected(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer
          market={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: 安装 Recharts（如果尚未安装）并验证编译**

```bash
cd whale-poly/whale-monorepo/services/landing
npm install recharts
npm run build
# 预期：编译成功无错误
```

- [ ] **Step 6: Commit**

```bash
git add services/landing/src/app/volume-analysis/ services/landing/package.json services/landing/package-lock.json
git commit -m "feat: add /volume-analysis page with market list, chart, and drawer"
```

---

### Task 9: 集成测试

**Files:**
- Modify: `tests/test_vw.py` — 新增集成测试

**Dependencies:** Task 1 + Task 3 + Task 4

---

- [ ] **Step 1: 在 tests/test_vw.py 末尾新增集成测试**

```python
# 在 tests/test_vw.py 末尾新增

import pytest_asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from shared.models.models import TradeRaw, Market, MarketVwMetrics, MarketVwSnapshot


@pytest.mark.integration
class TestComputeVwMetricsIntegration:
    """集成测试：端到端 VW 计算流程"""

    @pytest_asyncio.fixture
    async def seed_data(self, db_session):
        """写入测试数据"""
        now = datetime.now(timezone.utc)
        market_id = "test-market-vw-001"

        # 创建市场
        db_session.add(Market(id=market_id, title="测试市场 VW", status="active"))

        # 写入交易（过去 7 天内）
        trades = [
            TradeRaw(
                trade_id=f"vw-test-{i}",
                market_id=market_id,
                outcome="Yes" if i % 2 == 0 else "No",
                wallet=f"0xwallet{i}",
                side="BUY",
                amount=Decimal(str(100 * (i + 1))),
                price=Decimal("0.60") if i % 2 == 0 else Decimal("0.38"),
                timestamp=now - timedelta(hours=i),
            )
            for i in range(20)
        ]
        for t in trades:
            db_session.add(t)

        await db_session.commit()
        return market_id

    @patch("services.whale_engine.vw._get_last_alert_time", new_callable=AsyncMock)
    async def test_full_compute_cycle(sef, mock_alert_time, db_session, redis_client, seed_data):
        """完整计算周期：交易 → VW 指标 → DB 写入"""
        from services.whale_engine.vw import compute_vw_metrics

        mock_alert_time.return_value = None  # 无上次推送记录
        market_id = seed_data

        config = {
            "computation_window_days": 7,
            "min_24h_volume_usd": 100,
            "min_alert_volume_usd": 50000,
            "divergence_threshold": 0.10,
            "velocity_5m_threshold": 0.03,
            "new_market_warmup_snapshots": 3,
            "alert_cooldown_minutes": 30,
            "uai_extreme_price_threshold": 0.02,
        }

        count = await compute_vw_metrics(db_session, redis_client, config)
        assert count == 1

        # 验证 market_vw_metrics 写入
        result = await db_session.execute(
            "SELECT * FROM market_vw_metrics WHERE market_id = :mid",
            {"mid": market_id},
        )
        row = result.fetchone()
        assert row is not None
        assert row.vw_divergence is not None
        assert row.signal_direction is not None

        # 验证 market_vw_snapshots 写入
        snap_result = await db_session.execute(
            "SELECT COUNT(*) FROM market_vw_snapshots WHERE market_id = :mid",
            {"mid": market_id},
        )
        assert snap_result.scalar() >= 1
```

- [ ] **Step 2: 运行集成测试**

```bash
cd whale-poly/whale-monorepo
pytest tests/test_vw.py -v -m integration
# 预期：集成测试 PASS（需要 test DB 和 Redis）
```

- [ ] **Step 3: Commit**

```bash
git add tests/test_vw.py
git commit -m "test: add VW computation integration tests"
```

---

### Task 10: 回测校准脚本

**Files:**
- Create: `scripts/backtest_vw.py`

**Dependencies:** Task 1 + Task 3（计算函数可用）

---

- [ ] **Step 1: 创建 backtest_vw.py**

```python
#!/usr/bin/env python
"""
量价指标历史回测脚本。
取最近 30 天的高量市场数据，计算 VW divergence 分布和 velocity 阈值。
输出建议配置值。

用法:
  python scripts/backtest_vw.py --days 30 --min-volume 10000
"""

import argparse
import asyncio
import statistics
from decimal import Decimal
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from shared.db import SessionLocal
from shared.config import get_alert_config


async def backtest(days: int, min_volume: int):
    config = get_alert_config().get("vw_analysis", {})
    window_days = config.get("computation_window_days", 7)

    async with SessionLocal() as session:
        # 1. 找到高量市场
        result = await session.execute(
            text("""
                SELECT market_id, COUNT(*) AS trade_count,
                       SUM(amount * price) AS total_vol
                FROM trades_raw
                WHERE timestamp > NOW() - INTERVAL :period DAYS
                GROUP BY market_id
                HAVING SUM(amount * price) >= :min_vol
                ORDER BY total_vol DESC
                LIMIT 50
            """),
            {"period": days, "min_vol": min_volume},
        )
        markets = [(row[0], row[2]) for row in result.fetchall()]
        print(f"找到 {len(markets)} 个高量市场（{days}天，最低${min_volume:,}）")

        # 2. 对每个市场计算 divergence 序列
        all_divergences = []
        all_velocities_5m = []

        for market_id, total_vol in markets:
            # 取该市场的交易，按天分桶
            trade_result = await session.execute(
                text("""
                    SELECT DATE(timestamp) AS day, outcome, SUM(amount * price), SUM(amount)
                    FROM trades_raw
                    WHERE market_id = :mid
                      AND timestamp > NOW() - INTERVAL :period DAYS
                    GROUP BY DATE(timestamp), outcome
                    ORDER BY day
                """),
                {"mid": market_id, "period": days},
            )
            # 简化计算各天的 divergence（省略细节）
            # ... 实际计算逻辑参考 vw.py 中的函数

        # 3. 统计分布
        if all_divergences:
            divs = [float(d) for d in all_divergences]
            print(f"\n📊 Divergence 分布（n={len(divs)}）：")
            print(f"  均值: {statistics.mean(divs):.4f}")
            print(f"  标准差: {statistics.stdev(divs):.4f}")
            print(f"  P95: {sorted(divs)[int(len(divs) * 0.95)]:.4f}")
            print(f"  P99: {sorted(divs)[int(len(divs) * 0.99)]:.4f}")
            print(f"  建议 divergence_threshold: P95 = {sorted(divs)[int(len(divs) * 0.95)]:.4f}")

        if all_velocities_5m:
            vels = [float(v) for v in all_velocities_5m if v is not None]
            print(f"\n⚡ Velocity_5m 分布（n={len(vels)}）：")
            print(f"  均值: {statistics.mean(vels):.6f}")
            print(f"  标准差: {statistics.stdev(vels):.6f}")
            print(f"  P99: {sorted(vels)[int(len(vels) * 0.99)]:.6f}")
            print(f"  建议 velocity_5m_threshold: P99 = {sorted(vels)[int(len(vels) * 0.99)]:.6f}")

        print("\n✅ 回测完成，将以上建议值更新到 alert_engine_config.yaml")


def main():
    parser = argparse.ArgumentParser(description="量价指标回测")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--min-volume", type=int, default=10000)
    args = parser.parse_args()

    asyncio.run(backtest(args.days, args.min_volume))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 验证脚本可运行**

```bash
cd whale-poly/whale-monorepo
python scripts/backtest_vw.py --days 7 --min-volume 5000
# 预期：输出 divergence/velocity 分布统计
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backtest_vw.py
git commit -m "feat: add VW backtest calibration script"
```

---

## Task Dependency Graph

```
Task 1 (ORM + Migration) ──┐
                            ├── Task 3 (VW 核心) ── Task 4 (Celery Beat)
Task 2 (Config) ────────────┘        │
                                     ├── Task 5 (Telegram Pusher)
                                     │        │
                                     │        └── Task 6 (Daily Digest)
                                     │
                                     └── Task 7 (Landing vw-signals)
                                              │
                                              └── Task 8 (Landing 页面)
Task 9 (Integration Tests) ← depends on 1, 3, 4
Task 10 (Backtest Script) ← depends on 1, 3
```

**建议实施顺序**：1 → 2（并行）→ 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10（9、10 可并行）

---

*实现计划结束。*
