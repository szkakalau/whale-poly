import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

const SITE_BASE = (() => {
  const fallback = 'https://www.sightwhale.com';
  const raw = process.env.NEXT_PUBLIC_SITE_URL || fallback;
  try {
    const url = new URL(raw);
    url.protocol = 'https:';
    if (url.hostname === 'sightwhale.com') {
      url.hostname = 'www.sightwhale.com';
    }
    return url.origin;
  } catch {
    return fallback;
  }
})();

type PageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 0;

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value >= 0 ? '' : '-'}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${value >= 0 ? '' : '-'}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function loadShareSummaryUncached(id: string) {
  const collection = await prisma.smartCollection.findUnique({
    where: { id },
    include: {
      whales: {
        orderBy: { snapshotDate: 'desc' },
        take: 200,
      },
    },
  });

  if (!collection || !collection.enabled) {
    return null;
  }

  const latestSnapshot =
    collection.whales.length > 0 ? collection.whales[0].snapshotDate : null;
  const whales =
    latestSnapshot === null
      ? []
      : collection.whales.filter((w) => w.snapshotDate.getTime() === latestSnapshot.getTime());
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

  const totals = stats.reduce(
    (acc, row) => {
      acc.total_profit += Number.isFinite(row.profit) ? row.profit : 0;
      acc.total_volume += Number.isFinite(row.volume) ? row.volume : 0;
      acc.avg_roi += Number.isFinite(row.roi) ? row.roi : 0;
      return acc;
    },
    { total_profit: 0, total_volume: 0, avg_roi: 0 },
  );

  const avgRoi = stats.length > 0 ? totals.avg_roi / stats.length : 0;

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description ?? '',
    active_wallets: whales.length,
    snapshot_date: latestSnapshot ? latestSnapshot.toISOString() : null,
    total_profit: totals.total_profit,
    total_volume: totals.total_volume,
    avg_roi: avgRoi,
  };
}

const loadShareSummaryCached = unstable_cache(loadShareSummaryUncached, ['smart-collection-share'], {
  revalidate: 60,
});

const loadShareSummary = cache((id: string) => loadShareSummaryCached(id));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await loadShareSummary(id);
  const name = data?.name || 'Smart Collection';
  const title = `${name} Performance Card`;
  const description = `Snapshot performance for the ${name} smart collection.`;
  const ogImage = `${SITE_BASE.replace(/\/$/, '')}/smart-collections/${encodeURIComponent(id)}/share/opengraph-image`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_BASE.replace(/\/$/, '')}/smart-collections/${encodeURIComponent(id)}/share`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: `/smart-collections/${id}`,
    },
  };
}

export default async function SmartCollectionSharePage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadShareSummary(id);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-lg font-semibold text-white">Collection unavailable</div>
          <div className="text-xs text-gray-400 mt-2">Please refresh or view the collection page.</div>
          <Link
            href={`/smart-collections/${encodeURIComponent(id)}`}
            className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-gray-100 hover:bg-white/10 mt-4"
          >
            Open collection
          </Link>
        </div>
      </div>
    );
  }

  const shareUrl = `${SITE_BASE.replace(/\/$/, '')}/smart-collections/${encodeURIComponent(
    data.id,
  )}/share`;
  const shareText = `Smart Collection ${data.name} · ${data.active_wallets} wallets · Avg ROI ${(data.avg_roi * 100).toFixed(2)}%`;
  const shareX = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const shareTelegram = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-white/5 to-cyan-500/10 p-8 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Smart Collection</p>
            <h1 className="text-3xl font-bold text-white mt-3">{data.name}</h1>
            <p className="text-xs text-gray-400 mt-2">{data.description || 'Curated smart money strategy'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Total Profit</div>
              <div className="text-xl font-semibold text-white mt-2">{formatUsd(data.total_profit)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Avg ROI</div>
              <div className="text-xl font-semibold text-white mt-2">{(data.avg_roi * 100).toFixed(2)}%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Total Volume</div>
              <div className="text-xl font-semibold text-white mt-2">{formatUsd(data.total_volume)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Active Wallets</div>
              <div className="text-xl font-semibold text-white mt-2">{data.active_wallets}</div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Snapshot {data.snapshot_date ? new Date(data.snapshot_date).toLocaleDateString() : '—'}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <a
              href={shareX}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-100 hover:bg-white/10"
            >
              Share to X
            </a>
            <a
              href={shareTelegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-100 hover:bg-white/10"
            >
              Share to Telegram
            </a>
          </div>
          <Link
            href={`/smart-collections/${encodeURIComponent(data.id)}`}
            className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
          >
            Open collection
          </Link>
        </div>
      </div>
    </div>
  );
}
