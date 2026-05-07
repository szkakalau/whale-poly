import { prisma } from '@/lib/prisma';
import { getUtcTodayStart } from '@/lib/live-signals-access';
import { fetchGammaMarketByConditionId } from '@/lib/polymarket-gamma';
import { isMarketStatusOpen, roiBuyHoldToResolution, roiFromHistoryPnl } from '@/lib/history-roi';

export type HistorySignalRow = {
  id: string;
  publishedAt: string;
  marketTitle: string;
  whaleScore: number | null;
  publishPrice: number | null;
  endPrice: number | null;
  roiPct: number | null;
};

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Max distinct Gamma condition_ids fetched per /history request (rate limit). */
export const MAX_GAMMA_CONDITION_LOOKUPS = 40;

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
  condition_id: string | null;
};

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
        (
          SELECT tc.condition_id
          FROM token_conditions tc
          WHERE tc.market_id = a.market_id
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

    const gammaCache = new Map<string, Awaited<ReturnType<typeof fetchGammaMarketByConditionId>>>();

    const candidatesForGamma = [
      ...new Set(
        rows
          .filter((r) => {
            const pnl = safeNum(r.hist_pnl);
            const usd = safeNum(r.hist_trade_usd);
            const fromHist = roiFromHistoryPnl(pnl, usd);
            return (
              fromHist == null &&
              r.condition_id &&
              String(r.condition_id).trim().length > 0 &&
              !isMarketStatusOpen(r.market_status)
            );
          })
          .map((r) => String(r.condition_id).trim()),
      ),
    ].slice(0, MAX_GAMMA_CONDITION_LOOKUPS);

    await Promise.all(
      candidatesForGamma.map(async (cid) => {
        const data = await fetchGammaMarketByConditionId(cid);
        gammaCache.set(cid, data);
      }),
    );

    return rows.map((row) => {
      const publishPrice = safeNum(row.publish_price);
      const histPnl = safeNum(row.hist_pnl);
      const histUsd = safeNum(row.hist_trade_usd);
      let roiPct = roiFromHistoryPnl(histPnl, histUsd);
      let endPrice: number | null = null;

      if (roiPct == null && row.condition_id) {
        const cid = String(row.condition_id).trim();
        const gamma = gammaCache.get(cid) ?? null;
        const resolved = roiBuyHoldToResolution(row.trade_side, row.outcome_token, publishPrice, gamma);
        roiPct = resolved.roiPct;
        endPrice = resolved.endPrice;
      }

      return {
        id: row.id,
        publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : String(row.published_at),
        marketTitle: row.market_title?.trim() || '—',
        whaleScore: safeNum(row.whale_score),
        publishPrice,
        endPrice,
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
} {
  const withRoi = rows.filter((r) => r.roiPct != null && Number.isFinite(r.roiPct));
  if (withRoi.length === 0) {
    return { total: rows.length, winRate: null, avgRoi: null };
  }
  const wins = withRoi.filter((r) => (r.roiPct as number) > 0).length;
  const avgRoi = withRoi.reduce((s, r) => s + (r.roiPct as number), 0) / withRoi.length;
  return {
    total: rows.length,
    winRate: wins / withRoi.length,
    avgRoi,
  };
}
