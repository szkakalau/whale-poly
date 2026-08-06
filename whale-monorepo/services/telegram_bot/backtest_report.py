"""Weekly backtest report — Elite-only Monday morning digest of prediction performance.

Pattern: matches `daily_vw_digest.py` — but runs weekly (Monday Beijing 09:00) and
only sends to Elite subscribers.

Reports:
  - Period accuracy / win rate / avg ROI
  - Tier breakdown (score 90+ / 80-89 / 70-79)
  - Signal edge vs random baseline
  - Walk-forward validation results (if available)
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, time, timedelta, timezone

import httpx
from sqlalchemy import func, select
from telegram import Bot
from telegram.error import TelegramError

from shared.config import settings
from shared.db import SessionLocal
from shared.models import Subscription
from services.telegram_bot.recipients import get_active_subscribers

logger = logging.getLogger(__name__)

API_TIMEOUT = 20.0


def _landing_base_url() -> str:
    import os
    raw = (os.getenv("LANDING_PUBLIC_BASE_URL") or "").strip()
    if raw:
        return raw.rstrip("/")
    return settings.landing_base_url


def _fmt_pct(v: float) -> str:
    sign = "+" if v > 0 else ""
    return f"{sign}{(v * 100):.1f}%"


def _fmt_pnl(v: float) -> str:
    sign = "+" if v > 0 else "-" if v < 0 else ""
    abs_v = abs(v)
    if abs_v >= 1_000_000:
        return f"{sign}${(abs_v / 1_000_000):.1f}M"
    if abs_v >= 1_000:
        return f"{sign}${(abs_v / 1_000):.1f}K"
    return f"{sign}${abs_v:.0f}"


def _format_report(report: dict, start: str, end: str) -> str:
    """Format a BacktestReport into a Telegram HTML message."""
    if not report:
        return "📊 <b>本周回测</b>\n\n暂无结算数据。下周再来查看。"

    metrics = report.get("metrics") or {}
    bl = report.get("baselineComparison") or {}
    wf = report.get("walkForward") or {}
    tiers = report.get("byScoreTier") or []
    total = report.get("totalSignals", 0)
    settled = report.get("settledSignals", 0)

    lines = [
        "📊 <b>Weekly Backtest Report</b>",
        f"<code>{start}</code> → <code>{end}</code>",
        f"信号总数: <b>{total}</b> | 已结算: <b>{settled}</b>",
        "",
    ]

    # Key metrics
    acc = metrics.get("accuracy")
    wr = metrics.get("winRate")
    avg_roi = metrics.get("avgRoi")
    sharpe = metrics.get("sharpeRatio")
    dd = metrics.get("maxDrawdown")
    pf = metrics.get("profitFactor")
    total_pnl = metrics.get("totalPnl")

    lines.append("🎯 <b>核心指标</b>")
    if acc is not None:
        lines.append(f"准确率: <b>{_fmt_pct(acc)}</b>")
    if wr is not None:
        lines.append(f"胜率: <b>{_fmt_pct(wr)}</b>")
    if avg_roi is not None:
        lines.append(f"均 ROI: <b>{_fmt_pct(avg_roi)}</b>")
    if sharpe is not None:
        lines.append(f"Sharpe: <code>{sharpe:.2f}</code>")
    if dd is not None:
        lines.append(f"最大回撤: <b>{_fmt_pct(dd)}</b>")
    if pf is not None and pf != float("inf"):
        lines.append(f"盈亏比: <code>{pf:.2f}</code>")
    if total_pnl is not None:
        lines.append(f"总 PnL: <b>{_fmt_pnl(total_pnl)}</b>")
    lines.append("")

    # Tier breakdown
    if tiers:
        lines.append("📈 <b>按评分分段</b>")
        for t in tiers[:5]:
            tier_name = t.get("tier", "?")
            t_wr = t.get("winRate")
            t_roi = t.get("avgRoi")
            t_count = t.get("count", 0)
            wr_str = _fmt_pct(t_wr) if t_wr is not None else "—"
            roi_str = _fmt_pct(t_roi) if t_roi is not None else "—"
            lines.append(
                f"Score {tier_name}: {wr_str} WR | {roi_str} ROI | <b>{t_count}</b> 笔"
            )
        lines.append("")

    # Baseline comparison
    if bl:
        signal_edge = bl.get("signalVsRandom")
        signal_wr = bl.get("signalWinRate")
        bnh_roi = bl.get("buyAndHoldRoi")

        lines.append("⚖️ <b>vs 基准</b>")
        if signal_edge is not None:
            lines.append(f"信号优势: <b>{_fmt_pct(signal_edge)}</b> vs 50% 随机")
        if signal_wr is not None:
            lines.append(f"信号胜率: <b>{_fmt_pct(signal_wr)}</b>")
        if bnh_roi is not None:
            lines.append(f"买入持有: <b>{_fmt_pct(bnh_roi)}</b>")
        lines.append("")

    # Walk-forward (Elite feature)
    if wf and wf.get("folds", 0) > 0:
        folds = wf.get("folds", 0)
        oos_acc = wf.get("avgOosAccuracy")
        oos_wr = wf.get("avgOosWinRate")
        lines.append("🔄 <b>Walk-Forward 验证</b>")
        lines.append(f"Fold 数: <b>{folds}</b>")
        if oos_acc is not None:
            lines.append(f"OOS 准确率: <b>{_fmt_pct(oos_acc)}</b>")
        if oos_wr is not None:
            lines.append(f"OOS 胜率: <b>{_fmt_pct(oos_wr)}</b>")
        lines.append("")

    lines.append(f"完整报告 → {_landing_base_url()}/backtesting")

    return "\n".join(lines)


async def run_backtest_report(stop: asyncio.Event, bot: Bot) -> None:
    """Send weekly backtest report on Monday Beijing 09:00 (UTC 01:00)."""
    logger.info("backtest_report_started")

    while not stop.is_set():
        now = datetime.now(timezone.utc)

        # Target: Monday 01:00 UTC (Beijing 09:00)
        target_utc = time(1, 0)

        # Days until next Monday (weekday() == 0 is Monday)
        days_until_monday = (7 - now.weekday()) % 7
        # If it's Monday and we're past the target time, wait until next Monday
        if days_until_monday == 0 and now.time() >= target_utc:
            days_until_monday = 7

        next_monday = now.replace(
            hour=target_utc.hour,
            minute=target_utc.minute,
            second=0,
            microsecond=0,
        ) + timedelta(days=days_until_monday)

        seconds_until = (next_monday - now).total_seconds()

        logger.info(f"backtest_report_next_in {seconds_until}s")
        await asyncio.sleep(seconds_until)

        try:
            # Only send to Elite subscribers
            async with SessionLocal() as session:
                now_dt = datetime.now(timezone.utc)
                result = await session.execute(
                    select(Subscription.telegram_id)
                    .where(Subscription.status.in_(["active", "trialing"]))
                    .where(Subscription.current_period_end > now_dt)
                    .where(func.lower(Subscription.plan) == "elite")
                    .distinct()
                )
                elite_ids = list(result.scalars().all())

            if not elite_ids:
                logger.info("backtest_report_no_elite_subscribers")
                continue

            # Fetch backtest data for the past 7 days
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            start_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

            async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
                resp = await client.get(
                    f"{_landing_base_url()}/api/backtest",
                    params={"start": start_date, "end": end_date},
                    timeout=API_TIMEOUT,
                )
                resp.raise_for_status()
                data = resp.json()

            report = data.get("report") if isinstance(data, dict) else None
            message = _format_report(report or {}, start_date, end_date)

            sent = 0
            for tg_id in elite_ids:
                try:
                    await bot.send_message(
                        tg_id, message, parse_mode="HTML", disable_web_page_preview=True
                    )
                    sent += 1
                except TelegramError:
                    await asyncio.sleep(0.05)
                    continue

            logger.info(f"backtest_report_sent elite_recipients={sent}")

        except Exception:
            logger.exception("backtest_report_failed")
            await asyncio.sleep(60)
