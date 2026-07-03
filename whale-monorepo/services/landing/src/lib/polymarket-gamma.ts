/**
 * Minimal Gamma API helpers for resolved-market prices (public, no auth).
 * @see https://docs.polymarket.com/developers/gamma-markets-api/get-markets
 */

export type GammaMarketSlice = {
  conditionId: string;
  closed: boolean;
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
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

function parseGammaMarket(row: unknown, fallbackConditionId: string): GammaMarketSlice | null {
  if (!row || typeof row !== 'object') return null;

  const r = row as Record<string, unknown>;
  const outcomesRaw = parseJsonArray(r.outcomes).map((x) => String(x ?? '').trim());
  const pricesRaw = parseJsonArray(r.outcomePrices).map(toNum);
  const tokensRaw = parseJsonArray(r.clobTokenIds).map((x) => String(x ?? '').trim().toLowerCase());

  const cid = String(r.conditionId ?? r.condition_id ?? fallbackConditionId).trim();
  const closed =
    r.closed === true ||
    r.closed === 'true' ||
    r.isResolved === true ||
    r.active === false ||
    r.active === 'false';

  if (outcomesRaw.length === 0 || pricesRaw.length === 0) return null;
  const n = Math.min(outcomesRaw.length, pricesRaw.length);
  /** Keep outcomes[i], outcomePrices[i], and clobTokenIds[i] aligned. */
  const outcomes: string[] = [];
  const outcomePrices: number[] = [];
  const clobTokenIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = pricesRaw[i];
    if (Number.isFinite(p)) {
      outcomes.push(outcomesRaw[i]);
      outcomePrices.push(p);
      clobTokenIds.push(tokensRaw[i] ?? '');
    }
  }
  if (outcomes.length === 0) return null;

  return { conditionId: cid, closed, outcomes, outcomePrices, clobTokenIds };
}

async function fetchGammaMarketByParam(param: string, value: string): Promise<GammaMarketSlice | null> {
  const id = String(value || '').trim();
  if (!id) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.append(param, id);
    url.searchParams.set('limit', '1');
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as unknown;
    const row = Array.isArray(data) ? data[0] : null;
    return parseGammaMarket(row, id);
  } catch {
    return null;
  }
}

/** Fetch one market by condition id (Gamma uses hex condition ids). */
export async function fetchGammaMarketByConditionId(conditionId: string): Promise<GammaMarketSlice | null> {
  return fetchGammaMarketByParam('condition_ids', conditionId);
}

/** Fetch one market by CLOB token id (the raw token id stored on alerts/trades). */
export async function fetchGammaMarketByClobTokenId(tokenId: string): Promise<GammaMarketSlice | null> {
  return fetchGammaMarketByParam('clobTokenIds', tokenId);
}

/**
 * Index of winning outcome after resolution (price ~= 1).
 * Uses outcome prices only — Gamma often omits `closed` even when prices are 1/0.
 */
export function winningOutcomeIndex(slice: GammaMarketSlice): number | null {
  const prices = slice.outcomePrices;
  if (prices.length === 0) return null;
  let bestI = -1;
  let bestP = -1;
  let secondP = -1;
  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    if (p > bestP) {
      secondP = bestP;
      bestP = p;
      bestI = i;
    } else if (p > secondP) {
      secondP = p;
    }
  }
  if (bestI < 0 || bestP < 0.51) return null;
  if (bestP >= 0.85) return bestI;
  if (bestP >= 0.72 && secondP >= 0 && bestP - secondP >= 0.38) return bestI;
  return null;
}
