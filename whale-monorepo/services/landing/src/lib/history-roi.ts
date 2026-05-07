import type { GammaMarketSlice } from '@/lib/polymarket-gamma';
import { winningOutcomeIndex } from '@/lib/polymarket-gamma';

/** Polymarket-style market.status from our DB — still trading. */
export function isMarketStatusOpen(status: string | null | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase().trim();
  return s === 'active' || s === 'open' || s === 'trading';
}

/**
 * Realized ROI on the alert trade when whale_trade_history attributes PnL to this fill.
 * Returns decimal ROI (e.g. 0.25 = +25%).
 */
export function roiFromHistoryPnl(pnl: number | null, tradeUsd: number | null): number | null {
  if (pnl == null || tradeUsd == null) return null;
  if (!Number.isFinite(pnl) || !Number.isFinite(tradeUsd) || tradeUsd <= 0) return null;
  if (Math.abs(pnl) < 1e-12) return null;
  return pnl / tradeUsd;
}

function normOutcome(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Match traded outcome label to Gamma outcomes array (fuzzy). */
function outcomeIndex(outcomes: string[], traded: string | null): number | null {
  if (!traded || outcomes.length === 0) return null;
  const t = normOutcome(traded);
  const exact = outcomes.findIndex((o) => normOutcome(o) === t);
  if (exact >= 0) return exact;
  const short = t.includes('/') ? t.split('/').pop()?.trim() ?? t : t;
  const partial = outcomes.findIndex((o) => {
    const n = normOutcome(o);
    return n.includes(short) || short.includes(n);
  });
  return partial >= 0 ? partial : null;
}

/**
 * Hold-to-resolution ROI for a **BUY** of a single outcome token at price `entry` in (0,1).
 * - Win on that outcome: (1 - entry) / entry
 * - Lose: -1 (full stake loss)
 * SELL / ambiguous paths → null.
 */
export function roiBuyHoldToResolution(
  tradeSide: string | null,
  outcomeToken: string | null,
  entryPrice: number | null,
  gamma: GammaMarketSlice | null,
): { roiPct: number | null; endPrice: number | null } {
  if (entryPrice == null || !Number.isFinite(entryPrice) || entryPrice <= 0 || entryPrice >= 1) {
    return { roiPct: null, endPrice: null };
  }
  const side = String(tradeSide || '').toUpperCase().trim();
  if (side !== 'BUY') return { roiPct: null, endPrice: null };
  if (!gamma) return { roiPct: null, endPrice: null };

  const winIdx = winningOutcomeIndex(gamma);
  if (winIdx == null) return { roiPct: null, endPrice: null };

  const heldIdx = outcomeIndex(gamma.outcomes, outcomeToken);
  if (heldIdx == null) return { roiPct: null, endPrice: null };

  const won = heldIdx === winIdx;
  const endPrice = won ? 1 : 0;
  const roiPct = won ? (1 - entryPrice) / entryPrice : -1;
  return { roiPct, endPrice };
}
