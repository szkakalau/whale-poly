import { NextRequest, NextResponse } from 'next/server';

const WHALE_ENGINE = process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'metrics';

  try {
    switch (action) {
      case 'metrics': {
        const sortBy = searchParams.get('sortBy') || 'volume';
        const limit = searchParams.get('limit') || '50';
        const res = await fetch(
          `${WHALE_ENGINE}/vw/metrics?sort_by=${sortBy}&limit=${limit}`
        );
        const json = await res.json();
        return NextResponse.json(json);
      }

      case 'snapshots': {
        const marketId = searchParams.get('marketId');
        if (!marketId) {
          return NextResponse.json(
            { error: 'marketId is required' },
            { status: 400 }
          );
        }
        const hours = searchParams.get('hours') || '24';
        const res = await fetch(
          `${WHALE_ENGINE}/vw/snapshots?marketId=${encodeURIComponent(marketId)}&hours=${hours}`
        );
        const json = await res.json();
        return NextResponse.json(json);
      }

      case 'cross': {
        const marketId = searchParams.get('marketId');
        if (!marketId) {
          return NextResponse.json(
            { error: 'marketId is required' },
            { status: 400 }
          );
        }
        const res = await fetch(
          `${WHALE_ENGINE}/vw/cross?marketId=${encodeURIComponent(marketId)}`
        );
        const json = await res.json();
        return NextResponse.json(json);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'whale_engine unreachable', detail: err?.message },
      { status: 502 }
    );
  }
}
