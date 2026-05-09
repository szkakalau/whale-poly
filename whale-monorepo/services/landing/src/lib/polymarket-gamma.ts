/**
 * Minimal Gamma API helpers for resolved-market prices (public, no auth).
 * @see https://docs.polymarket.com/developers/gamma-markets-api/get-markets
 */

export type GammaMarketSlice = {
  conditionId: string;
  closed: boolean;
  outcomes: string[];
  outcomePrices: number[];
};

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const x = JSON.parse(value);
      return Array.isArray(x) ? x : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Fetch one market by condition id (Gamma uses hex condition ids). */
export async function fetchGammaMarketByConditionId(conditionId: string): Promise<GammaMarketSlice | null> {
  const id = String(conditionId || '').trim();
  if (!id) return null;

  try {
    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.append('condition_ids', id);
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as unknown;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== 'object') return null;

    const r = row as Record<string, unknown>;
    const outcomesRaw = parseJsonArray(r.outcomes).map((x) => String(x ?? '').trim());
    const pricesRaw = parseJsonArray(r.outcomePrices).map(toNum).filter((n) => Number.isFinite(n));

    const cid = String(r.conditionId ?? r.condition_id ?? id).trim();
    const closed =
      r.closed === true ||
      r.closed === 'true' ||
      r.isResolved === true ||
      r.active === false ||
      r.active === 'false';

    if (outcomesRaw.length === 0 || pricesRaw.length === 0) return null;
    const n = Math.min(outcomesRaw.length, pricesRaw.length);
    const outcomes = outcomesRaw.slice(0, n);
    const outcomePrices = pricesRaw.slice(0, n);

    return { conditionId: cid, closed, outcomes, outcomePrices };
  } catch {
    return null;
  }
}

/**
 * Index of winning outcome after resolution (price ~= 1).
 * Uses outcome prices only — Gamma often omits `closed` even when prices are 1/0.
 */
export function winningOutcomeIndex(slice: GammaMarketSlice): number | null {
  let bestI = -1;
  let bestP = -1;
  for (let i = 0; i < slice.outcomePrices.length; i++) {
    const p = slice.outcomePrices[i];
    if (p > bestP) {
      bestP = p;
      bestI = i;
    }
  }
  if (bestI < 0 || bestP < 0.85) return null;
  return bestI;
}
