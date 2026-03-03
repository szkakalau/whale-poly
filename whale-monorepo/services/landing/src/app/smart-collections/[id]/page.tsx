import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import SmartCollectionsClient, {
  type SmartCollectionItem,
} from '../SmartCollectionsClient';
import Link from 'next/link';

type PageProps = {
  params: Promise<{ id: string }>;
};

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://sightwhale.com';

async function loadSmartCollectionDetail(id: string, userId: string | null) {
  const collection = await prisma.smartCollection.findUnique({
    where: {
      id,
    },
    include: {
      whales: {
        orderBy: {
          snapshotDate: 'desc',
        },
        take: 100,
      },
    },
  });

  if (!collection || !collection.enabled) {
    return null;
  }

  const latestSnapshot =
    collection.whales.length > 0
      ? collection.whales[0].snapshotDate
      : null;

  const whales =
    latestSnapshot === null
      ? []
      : collection.whales.filter(
          (w) => w.snapshotDate.getTime() === latestSnapshot.getTime(),
        );

  const wallets = whales.map((w) => w.wallet);
  let stats: {
    wallet_address: string;
    volume: number;
    profit: number;
    roi: number;
  }[] = [];
  if (wallets.length > 0) {
    stats = await prisma.$queryRawUnsafe<
      {
        wallet_address: string;
        volume: number;
        profit: number;
        roi: number;
        ord: number;
      }[]
    >(
      `
      SELECT 
        t.wallet AS wallet_address,
        COALESCE(p.total_volume::float, 0) AS volume,
        COALESCE(s.total_pnl::float, p.realized_pnl::float, 0) AS profit,
        COALESCE(s.roi::float, CASE WHEN COALESCE(p.total_volume::float, 0) > 0 THEN (COALESCE(s.total_pnl::float, p.realized_pnl::float, 0) / COALESCE(p.total_volume::float, 1)) ELSE 0 END) AS roi,
        t.ord
      FROM unnest($1::text[]) WITH ORDINALITY AS t(wallet, ord)
      LEFT JOIN whale_profiles p ON p.wallet_address = t.wallet
      LEFT JOIN whale_stats s ON s.wallet_address = t.wallet
      ORDER BY t.ord ASC
      `,
      wallets,
    );
  }

  const statsMap = new Map(
    stats.map((s) => [
      s.wallet_address,
      {
        volume: Number.isFinite(s.volume) ? s.volume : 0,
        profit: Number.isFinite(s.profit) ? s.profit : 0,
        roi: Number.isFinite(s.roi) ? s.roi : 0,
      },
    ]),
  );

  const whalesWithStats = whales.map((w) => {
    const row = statsMap.get(w.wallet) || { volume: 0, profit: 0, roi: 0 };
    return { wallet: w.wallet, ...row };
  });

  const totalProfit = whalesWithStats.reduce((sum, w) => sum + w.profit, 0);
  const totalVolume = whalesWithStats.reduce((sum, w) => sum + w.volume, 0);
  const avgRoi =
    whalesWithStats.length > 0
      ? whalesWithStats.reduce((sum, w) => sum + w.roi, 0) / whalesWithStats.length
      : 0;
  const snapshotDate = latestSnapshot ? latestSnapshot.toISOString() : null;
  const snapshotHistory = collection.whales.reduce(
    (acc, whale) => {
      const key = whale.snapshotDate.toISOString();
      const current = acc.get(key) || 0;
      acc.set(key, current + 1);
      return acc;
    },
    new Map<string, number>(),
  );
  const history = Array.from(snapshotHistory.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 5)
    .map(([date, count]) => ({ snapshot_date: date, whale_count: count }));

  let subscribed = false;
  if (userId) {
    const sub = await prisma.smartCollectionSubscription.findUnique({
      where: {
        user_smart_collection_unique: {
          userId,
          smartCollectionId: collection.id,
        },
      },
      select: {
        id: true,
      },
    });
    subscribed = Boolean(sub);
  }

  return {
    item: {
      id: collection.id,
      name: collection.name,
      description: collection.description ?? '',
      subscribed,
    } as SmartCollectionItem,
    whales: whalesWithStats,
    summary: {
      total_profit: totalProfit,
      total_volume: totalVolume,
      avg_roi: avgRoi,
      active_wallets: whalesWithStats.length,
      snapshot_date: snapshotDate,
    },
    history,
  };
}

export default async function SmartCollectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const detail = await loadSmartCollectionDetail(id, user ? user.id : null);

  if (!detail) {
    return (
      <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-3xl px-6 pt-32 pb-24 relative">
          <h1 className="text-2xl font-semibold text-white mb-4">
            Smart collection not found
          </h1>
          <p className="text-sm text-gray-400 mb-6">
            This smart collection is not available. It may have been disabled or does not exist.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const maxHistoryCount = detail.history.reduce(
    (max, row) => Math.max(max, row.whale_count),
    0,
  );
  const shareUrl = `${SITE_BASE.replace(/\/$/, '')}/smart-collections/${encodeURIComponent(
    detail.item.id,
  )}/share`;
  const shareText = `Smart Collection ${detail.item.name} · ${detail.summary.active_wallets} wallets · Avg ROI ${(
    detail.summary.avg_roi * 100
  ).toFixed(2)}%`;
  const shareX = `https://x.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(shareUrl)}`;
  const shareTelegram = `https://t.me/share/url?url=${encodeURIComponent(
    shareUrl,
  )}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-32 pb-24 relative space-y-8">
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
              Smart Collection
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {detail.item.name}
            </h1>
            {detail.item.description && (
              <p className="text-sm text-gray-400 max-w-xl">
                {detail.item.description}
              </p>
            )}
          </div>
          <div className="min-w-[220px]">
            <SmartCollectionsClient
              initialItems={[detail.item]}
              canManage={Boolean(user)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">
              Current whales in this collection
            </h2>
          </div>
          {detail.whales.length === 0 ? (
            <div className="text-sm text-gray-400">
              No wallets are currently in this smart collection snapshot. As new whales meet the
              rules, they will appear here and drive alerts for subscribers.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Wallet</th>
                    <th className="px-3 py-2 font-medium text-right">Profit (USD)</th>
                    <th className="px-3 py-2 font-medium text-right">ROI</th>
                    <th className="px-3 py-2 font-medium text-right">Volume (USD)</th>
                    <th className="px-3 py-2 font-medium text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-200">
                  {detail.whales.map((w) => (
                    <tr key={w.wallet} className="hover:bg-white/[0.03]">
                      <td className="px-3 py-2 font-mono text-xs">
                        {w.wallet}
                      </td>
                      <td className="px-3 py-2 text-right">{Math.round(w.profit).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{(w.roi * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right">{Math.round(w.volume).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/whales/${encodeURIComponent(w.wallet)}`}
                          className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
                        >
                          Open Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Profit</p>
            <div className="text-2xl font-semibold text-white mt-2">
              {Math.round(detail.summary.total_profit).toLocaleString()} USD
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Avg ROI</p>
            <div className="text-2xl font-semibold text-white mt-2">
              {(detail.summary.avg_roi * 100).toFixed(2)}%
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Volume</p>
            <div className="text-2xl font-semibold text-white mt-2">
              {Math.round(detail.summary.total_volume).toLocaleString()} USD
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Active Wallets</p>
            <div className="text-2xl font-semibold text-white mt-2">
              {detail.summary.active_wallets}
            </div>
            {detail.summary.snapshot_date && (
              <div className="text-xs text-gray-500 mt-2">
                Snapshot: {new Date(detail.summary.snapshot_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Trust & Methodology</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Methodology</div>
                <div className="text-sm text-gray-200">
                  Profit/ROI/Volume are aggregated from each whale’s historical performance.
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Latest Snapshot</div>
                <div className="text-sm text-gray-200">
                  {detail.summary.snapshot_date
                    ? new Date(detail.summary.snapshot_date).toLocaleDateString()
                    : 'No snapshot yet'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Selection Logic</div>
                <div className="text-sm text-gray-200">
                  Whales are selected by the collection rules and shown from the latest snapshot.
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Snapshot History</h2>
            {detail.history.length === 0 ? (
              <div className="text-sm text-gray-400">No snapshot history yet</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end gap-2 h-24">
                  {detail.history
                    .slice()
                    .reverse()
                    .map((row) => {
                      const height =
                        maxHistoryCount > 0
                          ? Math.max(10, (row.whale_count / maxHistoryCount) * 96)
                          : 10;
                      return (
                        <div key={row.snapshot_date} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full rounded-t-lg bg-gradient-to-t from-violet-500/20 to-cyan-400/40"
                            style={{ height: `${height}px` }}
                          />
                          <span className="mt-2 text-[10px] text-gray-500">
                            {new Date(row.snapshot_date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <div className="space-y-2">
                  {detail.history.map((row) => (
                    <div
                      key={row.snapshot_date}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <span className="text-xs text-gray-300">
                        {new Date(row.snapshot_date).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {row.whale_count} wallets
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-2">Share this collection</h2>
              <p className="text-xs text-gray-400">
                Copy the link or share to social media.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <a
                href={shareX}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
              >
                Share to X
              </a>
              <a
                href={shareTelegram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
              >
                Share to Telegram
              </a>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1 font-medium text-violet-100 hover:bg-violet-500/20"
              >
                Open share card
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
