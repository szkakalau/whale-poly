#!/usr/bin/env python
"""
量价指标历史回测脚本。
取最近 N 天的高量市场数据，计算 VW divergence 分布和 velocity 阈值。
输出建议配置值，用于校准 alert_engine_config.yaml 中的阈值参数。

用法:
  python scripts/backtest_vw.py --days 30 --min-volume 10000
  python scripts/backtest_vw.py --days 7 --min-volume 5000 --top-n 20
"""

import argparse
import asyncio
import statistics
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import text

from services.whale_engine.vw import (
    _calc_vw_prices,
    _calc_divergence,
    _calc_velocity,
)
from shared.config import get_alert_config
from shared.db import SessionLocal


async def get_market_price_at(
    session, market_id: str, day: datetime.date
) -> Optional[Decimal]:
    """
    获取指定日期该市场的最新 YES 成交价格。
    先用当日最后一笔 YES 成交价；回退到用 NO 成交价推导。
    """
    result = await session.execute(
        text("""
            SELECT price FROM trades_raw
            WHERE market_id = :mid AND outcome = 'Yes'
              AND DATE(timestamp) = :day
            ORDER BY timestamp DESC LIMIT 1
        """),
        {"mid": market_id, "day": day},
    )
    row = result.fetchone()
    if row and row[0] is not None:
        return row[0]

    result = await session.execute(
        text("""
            SELECT price FROM trades_raw
            WHERE market_id = :mid AND outcome = 'No'
              AND DATE(timestamp) = :day
            ORDER BY timestamp DESC LIMIT 1
        """),
        {"mid": market_id, "day": day},
    )
    row = result.fetchone()
    if row and row[0] is not None:
        return Decimal("1") - row[0]

    return None


def _print_distribution(
    values: list[Decimal],
    label: str,
    threshold_key: str,
    percentile: float = 0.95,
    fmt: str = ".6f",
) -> None:
    """Print distribution statistics and suggest a YAML config threshold value."""
    floats = [float(v) for v in values]
    sorted_vals = sorted(floats)
    n = len(sorted_vals)
    mean = statistics.mean(floats)
    stdev = statistics.stdev(floats) if n > 1 else 0.0
    p_idx = min(n - 1, int(n * percentile))
    p_val = sorted_vals[p_idx]
    p99_idx = min(n - 1, int(n * 0.99))
    p99_val = sorted_vals[p99_idx]

    print(f"\n  {label} 分布（n={n}）：")
    print(f"    均值:      {mean:{fmt}}")
    print(f"    标准差:    {stdev:{fmt}}")
    print(f"    最小值:    {sorted_vals[0]:{fmt}}")
    print(f"    P{int(percentile * 100)}:       {p_val:{fmt}}")
    print(f"    P99:      {p99_val:{fmt}}")
    print(f"    最大值:    {sorted_vals[-1]:{fmt}}")
    print(f"    建议 {threshold_key}: {p_val:{fmt}}")


async def backtest(days: int, min_volume: int, top_n: int = 50) -> None:
    """Run the backtest: scan markets, compute distributions, print suggestions."""
    _ = get_alert_config().get("vw_analysis", {})

    print("=== 量价指标回测 ===")
    print(f"查询区间:     最近 {days} 天")
    print(f"最低交易量:    ${min_volume:,}")
    print(f"最多市场数:    {top_n}")
    print()

    async with SessionLocal() as session:
        # 1. 找到高量市场
        print("正在扫描高量市场...")
        result = await session.execute(
            text("""
                SELECT market_id, COUNT(*) AS trade_count,
                       SUM(amount * price) AS total_vol
                FROM trades_raw
                WHERE timestamp > NOW() - INTERVAL :period DAYS
                GROUP BY market_id
                HAVING SUM(amount * price) >= :min_vol
                ORDER BY total_vol DESC
                LIMIT :top_n
            """),
            {"period": days, "min_vol": min_volume, "top_n": top_n},
        )
        markets = [(row[0], row[2]) for row in result.fetchall()]
        print(f"找到 {len(markets)} 个高量市场")

        if not markets:
            print("没有找到符合条件的市场，请缩小 --min-volume 或扩大 --days。")
            return

        # 2. 遍历每个市场，计算逐日 divergence
        all_divergences: list[Decimal] = []
        all_velocities: list[Decimal] = []
        markets_processed = 0

        for idx, (market_id, total_vol) in enumerate(markets, 1):
            if idx % 10 == 0:
                print(f"  处理进度: {idx}/{len(markets)}")

            # 获取按天、按 outcome 聚合的交易数据
            trade_result = await session.execute(
                text("""
                    SELECT DATE(timestamp) AS day, outcome,
                           SUM(amount * price) AS turnover,
                           SUM(amount) AS token_amount
                    FROM trades_raw
                    WHERE market_id = :mid
                      AND timestamp > NOW() - INTERVAL :period DAYS
                      AND outcome IS NOT NULL
                    GROUP BY DATE(timestamp), outcome
                    ORDER BY day
                """),
                {"mid": market_id, "period": days},
            )
            rows = trade_result.fetchall()
            if not rows:
                continue

            # 按天组织数据
            daily_agg: dict[datetime.date, dict[str, Decimal]] = {}
            for day, outcome, turnover, token_amount in rows:
                if turnover is None or token_amount is None or turnover == 0:
                    continue
                if day not in daily_agg:
                    daily_agg[day] = {
                        "yes_amount": Decimal("0"),
                        "no_amount": Decimal("0"),
                    }
                key = (outcome or "").lower()
                if key == "yes":
                    daily_agg[day]["yes_amount"] += Decimal(str(token_amount))
                    daily_agg[day]["yes_avg_price"] = (
                        Decimal(str(turnover)) / Decimal(str(token_amount))
                    )
                elif key == "no":
                    daily_agg[day]["no_amount"] += Decimal(str(token_amount))
                    daily_agg[day]["no_avg_price"] = (
                        Decimal(str(turnover)) / Decimal(str(token_amount))
                    )

            if not daily_agg:
                continue

            # 计算每天 divergence
            sorted_days = sorted(daily_agg.keys())
            daily_divs: list[tuple[datetime.date, Decimal]] = []

            for day in sorted_days:
                agg = daily_agg[day]

                # 构建伪交易行供 _calc_vw_prices 使用
                pseudo_trades = []
                if agg.get("yes_amount", 0) > 0 and "yes_avg_price" in agg:
                    pseudo_trades.append(("Yes", agg["yes_amount"], agg["yes_avg_price"]))
                if agg.get("no_amount", 0) > 0 and "no_avg_price" in agg:
                    pseudo_trades.append(("No", agg["no_amount"], agg["no_avg_price"]))
                if not pseudo_trades:
                    continue

                vw = _calc_vw_prices(pseudo_trades)
                if vw is None:
                    continue

                day_price = await get_market_price_at(session, market_id, day)
                if day_price is None:
                    continue

                div = _calc_divergence(
                    vw.get("yes_vw_price"),
                    vw.get("no_vw_price"),
                    day_price,
                )
                if div is not None:
                    daily_divs.append((day, div))

            if len(daily_divs) < 2:
                continue

            # 收集所有 divergence
            for _, div in daily_divs:
                all_divergences.append(div)

            # 计算连续日之间的 velocity（per-minute rate）
            for i in range(1, len(daily_divs)):
                prev_day, prev_div = daily_divs[i - 1]
                curr_day, curr_div = daily_divs[i]

                delta = datetime.combine(
                    curr_day, datetime.min.time(), tzinfo=timezone.utc
                ) - datetime.combine(
                    prev_day, datetime.min.time(), tzinfo=timezone.utc
                )
                minutes = int(delta.total_seconds() / 60)
                if minutes <= 0:
                    continue

                vel = _calc_velocity(curr_div, prev_div, minutes)
                if vel is not None:
                    all_velocities.append(vel)

            markets_processed += 1

        print(f"\n成功处理 {markets_processed} 个市场")
        print("=" * 40)

        # 3. 输出分布统计和建议值
        if all_divergences:
            _print_distribution(
                all_divergences,
                "Divergence",
                "divergence_threshold",
                percentile=0.95,
            )
        else:
            print("\n没有收集到足够的 divergence 数据。")

        if all_velocities:
            _print_distribution(
                all_velocities,
                "Velocity（per-minute）",
                "velocity_5m_threshold",
                percentile=0.99,
                fmt=".8f",
            )
        else:
            print("\n没有收集到足够的 velocity 数据。")

        print(f"\n=== 回测完成 ===")
        print(
            "将以上建议值更新到 alert_engine_config.yaml 的 vw_analysis 节中。"
        )


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="量价指标回测校准脚本 - 分析历史交易数据，推荐 VW 阈值参数"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="回测天数（默认: 30）",
    )
    parser.add_argument(
        "--min-volume",
        type=int,
        default=10000,
        help="最低市场总成交量 USD（默认: 10000）",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=50,
        help="最多分析的市场数（默认: 50）",
    )
    return parser.parse_args(argv)


def main() -> None:
    """Entry point."""
    args = parse_args()
    asyncio.run(backtest(args.days, args.min_volume, args.top_n))


if __name__ == "__main__":
    main()
