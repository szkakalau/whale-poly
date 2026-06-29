import { NextRequest, NextResponse } from 'next/server';
import { getVwMetrics, getVwSnapshots, getCrossSignals } from '@/lib/vw-signals';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'metrics';

  switch (action) {
    case 'metrics': {
      const sortBy = (searchParams.get('sortBy') || 'volume') as
        | 'volume'
        | 'divergence'
        | 'strength';
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      try {
        const data = await getVwMetrics(sortBy, limit);
        return NextResponse.json({ data, count: data.length });
      } catch (err: any) {
        // Try a simple query to diagnose
        let diag = '';
        try {
          const { prisma } = await import('@/lib/prisma');
          const row = await prisma.$queryRawUnsafe<Array<{cnt: bigint}>>(
            'SELECT COUNT(*) as cnt FROM market_vw_metrics'
          );
          diag = `count=${Number(row[0]?.cnt ?? 0)}`;
        } catch (e2: any) {
          diag = `count query also failed: ${e2?.message}`;
        }
        return NextResponse.json(
          { error: 'metrics query failed', detail: err?.message || String(err), diag },
          { status: 500 }
        );
      }
    }

    case 'snapshots': {
      const marketId = searchParams.get('marketId');
      if (!marketId) {
        return NextResponse.json(
          { error: 'marketId query parameter is required.' },
          { status: 400 }
        );
      }
      const hours = parseInt(searchParams.get('hours') || '24', 10);
      const data = await getVwSnapshots(marketId, hours);
      return NextResponse.json({ data });
    }

    case 'cross': {
      const marketId = searchParams.get('marketId');
      if (!marketId) {
        return NextResponse.json(
          { error: 'marketId query parameter is required.' },
          { status: 400 }
        );
      }
      const data = await getCrossSignals(marketId);
      return NextResponse.json({ data });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
