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
