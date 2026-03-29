import argparse
import asyncio
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import SessionLocal, insert
from shared.models import TradeRaw, WhaleProfile, WhaleScore, WhaleStats, WhaleTradeHistory, Wallet
from services.whale_engine.engine import _combine_window_metrics, _compute_scores, _WindowMetrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Recompute whale_stats in batches.")
    parser.add_argument("--batch-size", type=int, default=200, help="wallets per batch")
    return parser.parse_args()


def _score_log(x: float, x_good: float) -> float:
    v = max(float(x), 0.0)
    g = max(float(x_good), 1.0)
    return max(0.0, min(100.0, (math.log10(v + 1.0) / math.log10(g + 1.0)) * 100.0))


def _market_context(raw_trades: list[TradeRaw]) -> tuple[dict[str, float], dict[str, float]]:
    market_volume: dict[str, float] = {}
    market_prices: dict[str, list[tuple[float, str]]] = {}
    for r in raw_trades:
        mid = str(r.market_id)
        vol = float(r.price) * float(r.amount)
        market_volume[mid] = market_volume.get(mid, 0.0) + vol
        market_prices.setdefault(mid, []).append((float(r.price), str(r.trade_id)))

    trade_percentiles: dict[str, float] = {}
    for mid, items in market_prices.items():
        items.sort(key=lambda x: x[0])
        n = len(items)
        for idx, (_, tid) in enumerate(items):
            p = idx / (n - 1) if n > 1 else 0.5
            trade_percentiles[tid] = p
    return market_volume, trade_percentiles


def _window_metrics(
    trades: list[WhaleTradeHistory],
    trade_cap: int,
    market_volume: dict[str, float],
    trade_percentiles: dict[str, float],
) -> _WindowMetrics | None:
    if not trades:
        return None
    trades = trades[:trade_cap]
    n_trades = len(trades)
    total_pnl = sum(float(t.pnl) for t in trades)
    total_vol = sum(float(t.trade_usd) for t in trades)
    avg_trade_size = total_vol / n_trades if n_trades > 0 else 0.0

    pnls = [float(t.pnl) for t in trades]
    mean_pnl = total_pnl / n_trades if n_trades > 0 else 0.0
    variance = sum((p - mean_pnl) ** 2 for p in pnls) / n_trades if n_trades > 0 else 0.0
    stddev_pnl = math.sqrt(variance) if n_trades > 0 else 0.0

    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    n_closed = len(wins) + len(losses)
    win_rate = len(wins) / n_closed if n_closed > 0 else 0.0

    avg_win = sum(wins) / len(wins) if wins else 0.0
    avg_loss = sum(abs(l) for l in losses) / len(losses) if losses else 0.0

    roi = total_pnl / total_vol if total_vol > 0 else 0.0
    risk_reward = avg_win / avg_loss if avg_loss > 0 else 0.0

    trades_asc = sorted(trades, key=lambda t: t.timestamp)
    current_cum = 0.0
    peak = -float("inf")
    max_dd = 0.0
    for t in trades_asc:
        current_cum += float(t.pnl)
        if current_cum > peak:
            peak = current_cum
        dd = peak - current_cum
        if dd > max_dd:
            max_dd = dd

    entry_prs: list[float] = []
    exit_prs: list[float] = []
    liquidity_ratios: list[float] = []
    market_counts: dict[str, int] = {}

    for t in trades:
        pr = trade_percentiles.get(t.trade_id, 0.5)
        side = str(t.side).lower()
        if side == "buy":
            entry_prs.append(pr)
        elif side == "sell":
            exit_prs.append(pr)

        m_vol = market_volume.get(t.market_id, 0.0)
        liq_ratio = float(t.trade_usd) / m_vol if m_vol > 0 else 0.0
        liquidity_ratios.append(liq_ratio)

        mid = str(t.market_id)
        market_counts[mid] = market_counts.get(mid, 0) + 1

    avg_entry = sum(entry_prs) / len(entry_prs) if entry_prs else 0.5
    avg_exit = sum(exit_prs) / len(exit_prs) if exit_prs else 0.5
    m_liq_ratio = sum(liquidity_ratios) / len(liquidity_ratios) if liquidity_ratios else 0.0
    top_cnt = max(market_counts.values()) if market_counts else 0
    top_frac = top_cnt / n_trades if n_trades > 0 else 0.0
    pnl_abs_ratio = abs(total_pnl) / total_vol if total_vol > 0 else 0.0

    return _WindowMetrics(
        trades=n_trades,
        win_rate=win_rate,
        roi=roi,
        total_pnl=total_pnl,
        total_volume=total_vol,
        avg_trade_size=avg_trade_size,
        max_drawdown=max_dd,
        stddev_pnl=stddev_pnl,
        avg_entry_percentile=avg_entry,
        avg_exit_percentile=avg_exit,
        risk_reward_ratio=risk_reward,
        market_liquidity_ratio=m_liq_ratio,
        top_market_fraction=top_frac,
        pnl_abs_ratio=pnl_abs_ratio,
    )


async def _fetch_raw_trades(session, since: datetime) -> list[TradeRaw]:
    raw_limit = int(os.getenv("WHALE_STATS_RAW_TRADE_CAP", "0"))
    tr_query = select(TradeRaw).where(TradeRaw.timestamp >= since)
    if raw_limit > 0:
        tr_query = tr_query.order_by(TradeRaw.timestamp.desc()).limit(raw_limit)
    return (await session.execute(tr_query)).scalars().all()


async def _fetch_history_rows(session, since: datetime, wallets: list[str]) -> list[WhaleTradeHistory]:
    history_limit = int(os.getenv("WHALE_STATS_HISTORY_CAP", "0"))
    q = (
        select(WhaleTradeHistory)
        .where(WhaleTradeHistory.timestamp >= since)
        .where(WhaleTradeHistory.wallet_address.in_(wallets))
        .order_by(WhaleTradeHistory.wallet_address, WhaleTradeHistory.timestamp.desc())
    )
    if history_limit > 0:
        q = q.limit(history_limit)
    return (await session.execute(q)).scalars().all()


async def main() -> int:
    args = parse_args()
    batch_size = max(int(args.batch_size), 1)
    trade_cap = int(os.getenv("WHALE_STATS_TRADE_CAP", "30"))
    days7 = max(1, int(os.getenv("WHALE_STATS_DAYS_7", "7")))
    days30 = max(1, int(os.getenv("WHALE_STATS_DAYS_30", "30")))
    days90 = max(1, int(os.getenv("WHALE_STATS_DAYS_90", "90")))

    now = datetime.now(timezone.utc)
    since7 = now - timedelta(days=days7)
    since30 = now - timedelta(days=days30)
    since90 = now - timedelta(days=days90)

    async with SessionLocal() as session:
        wallet_rows = (
            await session.execute(
                select(WhaleTradeHistory.wallet_address)
                .where(WhaleTradeHistory.timestamp >= since90)
                .distinct()
                .order_by(WhaleTradeHistory.wallet_address.asc())
            )
        ).all()
        wallets = [str(w) for (w,) in wallet_rows]
        if not wallets:
            print("No wallets found in whale_trade_history window.")
            return 0

        raw7 = await _fetch_raw_trades(session, since7)
        raw30 = await _fetch_raw_trades(session, since30)
        raw90 = await _fetch_raw_trades(session, since90)
        mv7, tp7 = _market_context(raw7)
        mv30, tp30 = _market_context(raw30)
        mv90, tp90 = _market_context(raw90)

        total_updated = 0
        for i in range(0, len(wallets), batch_size):
            batch = wallets[i : i + batch_size]
            h7 = await _fetch_history_rows(session, since7, batch)
            h30 = await _fetch_history_rows(session, since30, batch)
            h90 = await _fetch_history_rows(session, since90, batch)

            w7_map: dict[str, list[WhaleTradeHistory]] = defaultdict(list)
            w30_map: dict[str, list[WhaleTradeHistory]] = defaultdict(list)
            w90_map: dict[str, list[WhaleTradeHistory]] = defaultdict(list)

            for t in h7:
                w7_map[str(t.wallet_address)].append(t)
            for t in h30:
                w30_map[str(t.wallet_address)].append(t)
            for t in h90:
                w90_map[str(t.wallet_address)].append(t)

            age_rows = (
                await session.execute(
                    select(Wallet.address, Wallet.first_seen_at).where(Wallet.address.in_(batch))
                )
            ).all()
            first_seen_map = {str(a): fs for a, fs in age_rows}

            def wallet_age_days(addr: str) -> float:
                fs = first_seen_map.get(addr)
                if not fs:
                    return 0.0
                try:
                    d = (now - fs).total_seconds() / 86400.0
                    return float(max(d, 0.0))
                except Exception:
                    return 0.0

            values: list[dict[str, object]] = []
            profile_values: list[dict[str, object]] = []
            for addr in batch:
                w7 = _window_metrics(w7_map.get(addr, []), trade_cap, mv7, tp7)
                w30 = _window_metrics(w30_map.get(addr, []), trade_cap, mv30, tp30)
                w90 = _window_metrics(w90_map.get(addr, []), trade_cap, mv90, tp90)
                combined = _combine_window_metrics(w7, w30, w90)

                wash = False
                for w in (w30, w90):
                    if not w:
                        continue
                    if w.trades >= 10 and w.top_market_fraction >= 0.8 and w.pnl_abs_ratio <= 0.01:
                        wash = True
                        break

                scores = _compute_scores(
                    _WindowMetrics(
                        trades=combined.trades,
                        win_rate=combined.win_rate,
                        roi=combined.roi,
                        total_pnl=combined.total_pnl,
                        total_volume=combined.total_volume,
                        avg_trade_size=combined.avg_trade_size,
                        max_drawdown=combined.max_drawdown,
                        stddev_pnl=combined.stddev_pnl,
                        avg_entry_percentile=combined.avg_entry_percentile,
                        avg_exit_percentile=combined.avg_exit_percentile,
                        risk_reward_ratio=combined.risk_reward_ratio,
                        market_liquidity_ratio=combined.market_liquidity_ratio,
                        top_market_fraction=combined.top_market_fraction,
                        pnl_abs_ratio=combined.pnl_abs_ratio,
                    ),
                    wallet_age_days(addr),
                    wash,
                )

                whale_score = int(round(scores["whale_score"]))
                values.append(
                    {
                        "wallet_address": addr,
                        "whale_score": whale_score,
                        "performance_score": float(scores["performance_score"]),
                        "consistency_score": float(scores["consistency_score"]),
                        "timing_score": float(scores["timing_score"]),
                        "risk_score": float(scores["risk_score"]),
                        "impact_score": float(scores["impact_score"]),
                        "win_rate": float(combined.win_rate),
                        "roi": float(combined.roi),
                        "total_pnl": float(combined.total_pnl),
                        "avg_trade_size": float(combined.avg_trade_size),
                        "max_drawdown": float(combined.max_drawdown),
                        "stddev_pnl": float(combined.stddev_pnl),
                        "avg_entry_percentile": float(combined.avg_entry_percentile),
                        "avg_exit_percentile": float(combined.avg_exit_percentile),
                        "risk_reward_ratio": float(combined.risk_reward_ratio),
                        "market_liquidity_ratio": float(combined.market_liquidity_ratio),
                        "updated_at": now,
                    }
                )

                wins = int(round(combined.trades * combined.win_rate))
                losses = max(0, combined.trades - wins)
                profile_values.append(
                    {
                        "wallet_address": addr,
                        "total_volume": float(combined.total_volume),
                        "total_trades": int(combined.trades),
                        "realized_pnl": float(combined.total_pnl),
                        "wins": wins,
                        "losses": losses,
                        "updated_at": now,
                    }
                )

            if values:
                stmt = insert(WhaleStats).values(values)
                update_cols = {
                    "whale_score": stmt.excluded.whale_score,
                    "performance_score": stmt.excluded.performance_score,
                    "consistency_score": stmt.excluded.consistency_score,
                    "timing_score": stmt.excluded.timing_score,
                    "risk_score": stmt.excluded.risk_score,
                    "impact_score": stmt.excluded.impact_score,
                    "win_rate": stmt.excluded.win_rate,
                    "roi": stmt.excluded.roi,
                    "total_pnl": stmt.excluded.total_pnl,
                    "avg_trade_size": stmt.excluded.avg_trade_size,
                    "max_drawdown": stmt.excluded.max_drawdown,
                    "stddev_pnl": stmt.excluded.stddev_pnl,
                    "avg_entry_percentile": stmt.excluded.avg_entry_percentile,
                    "avg_exit_percentile": stmt.excluded.avg_exit_percentile,
                    "risk_reward_ratio": stmt.excluded.risk_reward_ratio,
                    "market_liquidity_ratio": stmt.excluded.market_liquidity_ratio,
                    "updated_at": now,
                }
                await session.execute(
                    stmt.on_conflict_do_update(index_elements=[WhaleStats.wallet_address], set_=update_cols)
                )

                score_values = [
                    {"wallet_address": v["wallet_address"], "final_score": v["whale_score"], "updated_at": now}
                    for v in values
                ]
                score_stmt = insert(WhaleScore).values(score_values)
                await session.execute(
                    score_stmt.on_conflict_do_update(
                        index_elements=[WhaleScore.wallet_address],
                        set_={"final_score": score_stmt.excluded.final_score, "updated_at": now},
                    )
                )

            if profile_values:
                profile_stmt = insert(WhaleProfile).values(profile_values)
                profile_update_cols = {
                    "total_volume": profile_stmt.excluded.total_volume,
                    "total_trades": profile_stmt.excluded.total_trades,
                    "realized_pnl": profile_stmt.excluded.realized_pnl,
                    "wins": profile_stmt.excluded.wins,
                    "losses": profile_stmt.excluded.losses,
                    "updated_at": now,
                }
                await session.execute(
                    profile_stmt.on_conflict_do_update(
                        index_elements=[WhaleProfile.wallet_address],
                        set_=profile_update_cols,
                    )
                )

            await session.commit()
            total_updated += len(values)
            print(f"batch {i // batch_size + 1} wallets {i + 1}-{min(i + batch_size, len(wallets))}/{len(wallets)} updated={total_updated}")

    print(f"✅ recompute_whale_stats_batched completed. Updated {total_updated} wallets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
