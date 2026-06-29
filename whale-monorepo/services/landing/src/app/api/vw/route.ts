import { NextRequest, NextResponse } from 'next/server';
import { getVwMetrics, getVwSnapshots, getCrossSignals } from '@/lib/vw-signals';
import { getCurrentUser } from '@/lib/auth';
import { Plan } from '@prisma/client';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  // Plan gating — Free users and guests get 403
  if (!user || (user.plan as Plan) === Plan.FREE) {
    return NextResponse.json(
      { error: 'Upgrade to Pro or Elite to access volume analysis.' },
      { status: 403 }
    );
  }

  // Check for expired plans
  if (user.planExpireAt && new Date() > user.planExpireAt) {
    return NextResponse.json(
      { error: 'Your subscription has expired.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'metrics';

  switch (action) {
    case 'metrics': {
      const sortBy = (searchParams.get('sortBy') || 'volume') as
        | 'volume'
        | 'divergence'
        | 'strength';
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const data = await getVwMetrics(sortBy, limit);
      return NextResponse.json({ data });
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
