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
  if (Math.abs(pnl) < 1e-12) return 0;
  return pnl / tradeUsd;
}

function normOutcome(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stripParenLabels(s: string): string {
  return normOutcome(s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' '));
}

function letterAlnum(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '');
}

/** Match traded outcome label to Gamma outcomes array (fuzzy). */
function outcomeIndex(outcomes: string[], traded: string | null): number | null {
  if (!traded || outcomes.length === 0) return null;
  const t = normOutcome(traded);
  const exact = outcomes.findIndex((o) => normOutcome(o) === t);
  if (exact >= 0) return exact;

  const tStrip = stripParenLabels(traded);
  const stripIdx = outcomes.findIndex((o) => stripParenLabels(o) === tStrip || stripParenLabels(o).includes(tStrip));
  if (stripIdx >= 0) return stripIdx;

  const short = t.includes('/') ? t.split('/').pop()?.trim() ?? t : t;
  const partial = outcomes.findIndex((o) => {
    const n = normOutcome(o);
    return n.includes(short) || short.includes(n);
  });
  if (partial >= 0) return partial;

  const ta = letterAlnum(t);
  if (ta.length >= 3) {
    const fuzzy = outcomes.findIndex((o) => {
      const lo = letterAlnum(normOutcome(o));
      return lo.includes(ta) || ta.includes(lo);
    });
    if (fuzzy >= 0) return fuzzy;
  }

  if (outcomes.length === 2) {
    const yesIdx = outcomes.findIndex((o) => /\byes\b/i.test(o) || /^y$/i.test(o.trim()));
    const noIdx = outcomes.findIndex((o) => /\bno\b/i.test(o) || /^n$/i.test(o.trim()));
    if (/^(yes|y)$/i.test(t.trim()) && yesIdx >= 0) return yesIdx;
    if (/^(no|n)$/i.test(t.trim()) && noIdx >= 0) return noIdx;
  }

  return null;
}

function outcomeIndexByToken(gamma: GammaMarketSlice, tokenId: string | null | undefined): number | null {
  const token = String(tokenId ?? '').trim().toLowerCase();
  if (!token) return null;
  const idx = gamma.clobTokenIds.findIndex((id) => id.toLowerCase() === token);
  return idx >= 0 ? idx : null;
}

function tradedOutcomeIndex(gamma: GammaMarketSlice, outcomeToken: string | null, clobTokenId?: string | null): number | null {
  return outcomeIndexByToken(gamma, clobTokenId) ?? outcomeIndex(gamma.outcomes, outcomeToken);
}

/**
 * Settlement price for the traded outcome leg from Gamma (any side — BUY/SELL).
 * Uses live outcomePrices once the market has a clear winner.
 */
export function settlementOutcomePrice(
  outcomeToken: string | null,
  gamma: GammaMarketSlice | null,
  clobTokenId?: string | null,
): number | null {
  if (!gamma) return null;
  if (winningOutcomeIndex(gamma) == null) return null;
  const heldIdx = tradedOutcomeIndex(gamma, outcomeToken, clobTokenId);
  if (heldIdx == null) return null;
  const p = gamma.outcomePrices[heldIdx];
  return Number.isFinite(p) ? p : null;
}

/**
 * Hold-to-resolution ROI from Gamma settlement prices (BUY and SELL).
 * - BUY: ROI vs cash paid = (S − entry) / entry  (S = settlement price of that outcome).
 * - SELL: ROI vs max loss per share = (entry − S) / (1 − entry).
 */
export function roiFromGammaTrade(
  tradeSide: string | null,
  outcomeToken: string | null,
  entryPrice: number | null,
  gamma: GammaMarketSlice | null,
  clobTokenId?: string | null,
): { roiPct: number | null; endPrice: number | null } {
  if (!gamma || entryPrice == null || !Number.isFinite(entryPrice) || entryPrice <= 0 || entryPrice >= 1) {
    return { roiPct: null, endPrice: null };
  }
  const side = String(tradeSide || '').toUpperCase().trim();
  if (side !== 'BUY' && side !== 'SELL') return { roiPct: null, endPrice: null };

  if (winningOutcomeIndex(gamma) == null) return { roiPct: null, endPrice: null };

  const heldIdx = tradedOutcomeIndex(gamma, outcomeToken, clobTokenId);
  if (heldIdx == null) return { roiPct: null, endPrice: null };

  const S = gamma.outcomePrices[heldIdx];
  if (!Number.isFinite(S)) return { roiPct: null, endPrice: null };

  const endPrice = S;

  if (side === 'BUY') {
    const roiPct = (S - entryPrice) / entryPrice;
    return { roiPct, endPrice };
  }

  const atRisk = 1 - entryPrice;
  if (atRisk <= 1e-14) return { roiPct: null, endPrice };
  const roiPct = (entryPrice - S) / atRisk;
  return { roiPct, endPrice };
}

/** @deprecated Use {@link roiFromGammaTrade} — kept for older imports. */
export function roiBuyHoldToResolution(
  tradeSide: string | null,
  outcomeToken: string | null,
  entryPrice: number | null,
  gamma: GammaMarketSlice | null,
): { roiPct: number | null; endPrice: number | null } {
  const side = String(tradeSide || '').toUpperCase().trim();
  if (side !== 'BUY') return { roiPct: null, endPrice: null };
  return roiFromGammaTrade(tradeSide, outcomeToken, entryPrice, gamma);
}
