import { prisma } from '@/lib/prisma';
import { getUtcTodayStart } from '@/lib/live-signals-access';
import { fetchGammaMarketByClobTokenId, fetchGammaMarketByConditionId } from '@/lib/polymarket-gamma';
import {
  outcomeLegPriceFromGamma,
  roiFromGammaTrade,
  roiFromHistoryPnl,
  settlementOutcomePrice,
} from '@/lib/history-roi';
import { shouldExcludeMarketFromPublicFeeds } from '@/lib/market-display-filter';

export type HistorySignalRow = {
  id: string;
  publishedAt: string;
  marketTitle: string;
  whaleScore: number | null;
  publishPrice: number | null;
  outcomeLabel: string | null;
  sideLabel: string | null;
  sizeUsd: number | null;
  walletMasked: string;
  endPrice: number | null;
  /** Realized PnL (USD) from whale_trade_history when present. */
  realizedPnlUsd: number | null;
  /** Best-effort PnL: prefers DB hist_pnl, falls back to sizeUsd × roiPct. */
  computedPnlUsd: number | null;
  roiPct: number | null;
};

function formatShortWallet(addr: string | null | undefined): string {
  const v = (addr ?? '').trim();
  if (!v) return '—';
  if (v.length <= 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

type RawHistoryRow = {
  id: string;
  published_at: Date;
  market_title: string | null;
  whale_score: unknown;
  publish_price: unknown;
  trade_side: string | null;
  outcome_token: string | null;
  market_status: string | null;
  hist_pnl: unknown;
  hist_trade_usd: unknown;
  wallet_address: string | null;
  trade_size_usd: unknown;
  raw_token_id: string | null;
  condition_id: string | null;
};

/** Max distinct Gamma condition_ids fetched per /history request (rate limit). */
export const MAX_GAMMA_CONDITION_LOOKUPS = 520;

async function fetchGammaMarketsBatched(
  conditionIds: string[],
  batchSize = 24,
): Promise<Map<string, Awaited<ReturnType<typeof fetchGammaMarketByConditionId>>>> {
  const cache = new Map<string, Awaited<ReturnType<typeof fetchGammaMarketByConditionId>>>();
  for (let i = 0; i < conditionIds.length; i += batchSize) {
    const chunk = conditionIds.slice(i, i + batchSize);
    const rows = await Promise.all(
      chunk.map(async (cid) => {
        const data = await fetchGammaMarketByConditionId(cid);
        return { cid, data };
      }),
    );
    for (const { cid, data } of rows) {
      cache.set(cid, data);
    }
  }
  return cache;
}

async function fetchGammaMarketsByTokenBatched(
  tokenIds: string[],
  batchSize = 24,
): Promise<Map<string, Awaited<ReturnType<typeof fetchGammaMarketByClobTokenId>>>> {
  const cache = new Map<string, Awaited<ReturnType<typeof fetchGammaMarketByClobTokenId>>>();
  for (let i = 0; i < tokenIds.length; i += batchSize) {
    const chunk = tokenIds.slice(i, i + batchSize);
    const rows = await Promise.all(
      chunk.map(async (tokenId) => {
        const data = await fetchGammaMarketByClobTokenId(tokenId);
        return { tokenId, data };
      }),
    );
    for (const { tokenId, data } of rows) {
      cache.set(tokenId.toLowerCase(), data);
    }
  }
  return cache;
}

function orderedUniqueValues(rows: RawHistoryRow[], getValue: (row: RawHistoryRow) => string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const value = getValue(r) ? String(getValue(r)).trim() : '';
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function tradeUsdDenominator(histTradeUsd: unknown, tradeSizeUsd: unknown): number | null {
  const h = safeNum(histTradeUsd);
  const s = safeNum(tradeSizeUsd);
  if (h != null && Number.isFinite(h) && h > 0) return h;
  if (s != null && Number.isFinite(s) && s > 0) return s;
  return null;
}

/** Public history: alerts before today 00:00 UTC (through end of yesterday). */
export async function loadPublicHistorySignals(limit = 500): Promise<HistorySignalRow[]> {
  const todayStart = new Date(getUtcTodayStart());
  try {
    const rows = await prisma.$queryRawUnsafe<RawHistoryRow[]>(
      `
      SELECT
        a.id,
        a.created_at AS published_at,
        COALESCE(NULLIF(TRIM(m.title), ''), a.market_id) AS market_title,
        a.whale_score::float8 AS whale_score,
        tr.price::float8 AS publish_price,
        tr.side AS trade_side,
        tr.outcome AS outcome_token,
        m.status AS market_status,
        wth.pnl::float8 AS hist_pnl,
        wth.trade_usd::float8 AS hist_trade_usd,
        COALESCE(NULLIF(TRIM(wt.wallet_address), ''), NULLIF(TRIM(a.wallet_address), '')) AS wallet_address,
        (tr.amount::numeric * tr.price::numeric)::float8 AS trade_size_usd,
        COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), '')) AS raw_token_id,
        (
          SELECT tc.condition_id
          FROM token_conditions tc
          WHERE tc.token_id = COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), ''))
             OR tc.market_id = COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), ''))
          ORDER BY CASE
            WHEN tc.token_id = COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), '')) THEN 0
            ELSE 1
          END
          LIMIT 1
        ) AS condition_id
      FROM alerts a
      LEFT JOIN whale_trades wt ON wt.id = a.whale_trade_id
      LEFT JOIN trades_raw tr ON tr.trade_id = wt.trade_id
      LEFT JOIN markets m ON m.id = a.market_id
      LEFT JOIN whale_trade_history wth ON wth.trade_id = wt.trade_id
      WHERE a.created_at < $1
      ORDER BY a.created_at DESC
      LIMIT $2
      `,
      todayStart,
      limit,
    );

    const visibleRows = rows.filter((r) => {
      const title = String(r.market_title ?? '').trim() || '—';
      return !shouldExcludeMarketFromPublicFeeds(title);
    });

    // Gamma enrichment — best-effort, non-fatal.
    let gammaTokenCache: Map<string, Awaited<ReturnType<typeof fetchGammaMarketByClobTokenId>>> = new Map();
    let gammaConditionCache: Map<string, Awaited<ReturnType<typeof fetchGammaMarketByConditionId>>> = new Map();
    try {
      const rawTokenIds = orderedUniqueValues(visibleRows, (r) => r.raw_token_id).slice(0, MAX_GAMMA_CONDITION_LOOKUPS);
      const gammaIds = orderedUniqueValues(visibleRows, (r) => r.condition_id).slice(0, MAX_GAMMA_CONDITION_LOOKUPS);
      const [tc, cc] = await Promise.all([
        fetchGammaMarketsByTokenBatched(rawTokenIds),
        fetchGammaMarketsBatched(gammaIds),
      ]);
      gammaTokenCache = tc;
      gammaConditionCache = cc;
    } catch {
      // Gamma enrichment unavailable — continue with empty caches (ROI from hist_pnl still works).
    }

    return visibleRows.map((row) => {
      const publishPrice = safeNum(row.publish_price);
      const histPnl = safeNum(row.hist_pnl);
      const denomUsd = tradeUsdDenominator(row.hist_trade_usd, row.trade_size_usd);
      let roiPct = roiFromHistoryPnl(histPnl, denomUsd);
      let endPrice: number | null = null;
      const rawTokenId = row.raw_token_id ? String(row.raw_token_id).trim() : '';
      const gammaFromToken = rawTokenId ? (gammaTokenCache.get(rawTokenId.toLowerCase()) ?? null) : null;

      if (roiPct == null) {
        const cid = row.condition_id ? String(row.condition_id).trim() : '';
        const gamma = gammaFromToken ?? (cid ? (gammaConditionCache.get(cid) ?? null) : null);
        const resolved = roiFromGammaTrade(row.trade_side, row.outcome_token, publishPrice, gamma, rawTokenId, {
          requireMarketResolved: true,
        });
        roiPct = resolved.roiPct;
        endPrice = resolved.endPrice;
      }

      if (endPrice == null) {
        const cid = row.condition_id ? String(row.condition_id).trim() : '';
        const gamma = gammaFromToken ?? (cid ? (gammaConditionCache.get(cid) ?? null) : null);
        endPrice =
          settlementOutcomePrice(row.outcome_token, gamma, rawTokenId) ??
          outcomeLegPriceFromGamma(row.outcome_token, gamma, rawTokenId);
      }

      if (roiPct == null) {
        const cid = row.condition_id ? String(row.condition_id).trim() : '';
        const gamma = gammaFromToken ?? (cid ? (gammaConditionCache.get(cid) ?? null) : null);
        const mtm = roiFromGammaTrade(row.trade_side, row.outcome_token, publishPrice, gamma, rawTokenId, {
          requireMarketResolved: false,
        });
        if (mtm.roiPct != null) roiPct = mtm.roiPct;
      }

      const sizeUsd = safeNum(row.trade_size_usd);
      const pnlFromHist = histPnl != null && Number.isFinite(histPnl) && Math.abs(histPnl) >= 0.01 ? histPnl : null;
      const pnlFromRoi =
        sizeUsd != null && roiPct != null && Number.isFinite(sizeUsd) && Number.isFinite(roiPct)
          ? sizeUsd * roiPct
          : null;
      const computedPnlUsd: number | null = pnlFromHist ?? pnlFromRoi ?? null;

      const sideRaw = String(row.trade_side ?? '')
        .trim()
        .toUpperCase();
      const sideLabel =
        sideRaw === 'BUY' || sideRaw === 'SELL' ? sideRaw : row.trade_side?.trim() ? row.trade_side.trim() : null;

      return {
        id: row.id,
        publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : String(row.published_at),
        marketTitle: row.market_title?.trim() || '—',
        whaleScore: safeNum(row.whale_score),
        publishPrice,
        outcomeLabel: row.outcome_token?.trim() ? row.outcome_token.trim() : null,
        sideLabel,
        sizeUsd,
        walletMasked: formatShortWallet(row.wallet_address),
        endPrice,
        realizedPnlUsd: pnlFromHist,
        computedPnlUsd,
        roiPct,
      };
    });
  } catch {
    return [];
  }
}

export function summarizeHistoryRows(rows: HistorySignalRow[]): {
  total: number;
  winRate: number | null;
  avgRoi: number | null;
  totalPnl: number | null;
} {
  const withRoi = rows.filter((r) => r.roiPct != null && Number.isFinite(r.roiPct));
  if (withRoi.length === 0) {
    return { total: rows.length, winRate: null, avgRoi: null, totalPnl: null };
  }
  const wins = withRoi.filter((r) => (r.roiPct as number) > 0).length;
  const avgRoi = withRoi.reduce((s, r) => s + (r.roiPct as number), 0) / withRoi.length;
  const totalPnl = withRoi.reduce((s, r) => s + (r.computedPnlUsd ?? 0), 0);
  return {
    total: rows.length,
    winRate: wins / withRoi.length,
    avgRoi,
    totalPnl: Number.isFinite(totalPnl) ? totalPnl : null,
  };
}
