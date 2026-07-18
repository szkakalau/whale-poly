import { NextRequest, NextResponse } from 'next/server';

const WHALE_ENGINE = process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';

const VALID_SORT_BY = ['volume', 'divergence', 'strength'] as const;

// Shared cache headers for all VW API responses (PF-M10).
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

function cached(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...CACHE_HEADERS },
  });
}

/**
 * Filter out markets that are likely resolved/inactive:
 * - Not recomputed in 7 days (dead market — either settled or abandoned)
 * - Price at extremes (≥ 0.995 or ≤ 0.005) indicating a resolved binary market
 */
function filterActiveOnly(data: unknown[]): unknown[] {
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return data.filter((row: any) => {
    // Extreme price → resolved
    const price = row.yesMarketPrice;
    if (price != null && (price >= 0.995 || price <= 0.005)) return false;
    // Stale data → no longer actively computed
    const computedAt = row.computedAt;
    if (computedAt) {
      const age = now - new Date(computedAt).getTime();
      if (age > SEVEN_DAYS_MS) return false;
    }
    return true;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'metrics';

  try {
    switch (action) {
      case 'metrics': {
        const sortByRaw = searchParams.get('sortBy') || 'volume';
        const sortBy = (VALID_SORT_BY as readonly string[]).includes(sortByRaw) ? sortByRaw : 'volume';
        const limitRaw = parseInt(searchParams.get('limit') || '50', 10);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
        const res = await fetch(
          `${WHALE_ENGINE}/vw/metrics?sort_by=${sortBy}&limit=${limit}`
        );
        const json = await res.json();
        // Filter out resolved/stale markets at the edge
        if (Array.isArray(json.data)) {
          json.data = filterActiveOnly(json.data);
        }
        return cached(json);
      }

      case 'snapshots': {
        const marketId = searchParams.get('marketId');
        if (!marketId) {
          return cached({ error: 'marketId is required' }, { status: 400 });
        }
        const hoursRaw = parseInt(searchParams.get('hours') || '24', 10);
        const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 168) : 24;
        const res = await fetch(
          `${WHALE_ENGINE}/vw/snapshots?marketId=${encodeURIComponent(marketId)}&hours=${hours}`
        );
        const json = await res.json();
        return cached(json);
      }

      case 'cross': {
        const marketId = searchParams.get('marketId');
        if (!marketId) {
          return cached({ error: 'marketId is required' }, { status: 400 });
        }
        const res = await fetch(
          `${WHALE_ENGINE}/vw/cross?marketId=${encodeURIComponent(marketId)}`
        );
        const json = await res.json();
        return cached(json);
      }

      default:
        return cached({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return cached(
      { error: 'whale_engine unreachable' },
      { status: 502 }
    );
  }
}
