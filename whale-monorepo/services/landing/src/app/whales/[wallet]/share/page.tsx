import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';
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

type WhaleShareData = {
  wallet: string;
  display_name: string;
  whale_score: number;
  stats: {
    total_volume: number;
    total_trades: number;
    win_rate: number;
    realized_pnl: number;
  };
  performance_30d: {
    pnl: number;
    win_rate: number;
    volume: number;
  };
};

type PageProps = {
  params: Promise<{ wallet: string }>;
};

export const revalidate = 0;

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

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

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

function formatWinRate(value: number, opts?: { trades?: number; pnl?: number; volume?: number }): string {
  if (!Number.isFinite(value)) return '—';
  const trades = opts?.trades;
  const pnl = opts?.pnl;
  const volume = opts?.volume;
  if (value === 0) {
    if (typeof trades === 'number' && trades === 0) return '—';
    if (typeof volume === 'number' && volume === 0) return '—';
    if (typeof pnl === 'number' && pnl > 0) return '—';
  }
  return formatPercent(value);
}

function shortenWallet(addr: string): string {
  const v = (addr || '').trim();
  if (v.length <= 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function normalizeShareData(payload: unknown, walletHint: string): WhaleShareData | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;

  if (data.stats && typeof data.stats === 'object') {
    const statsRaw = data.stats as Record<string, unknown>;
    const perfRaw =
      data.performance_30d && typeof data.performance_30d === 'object'
        ? (data.performance_30d as Record<string, unknown>)
        : {};
    return {
      wallet: safeString(data.wallet, walletHint),
      display_name: safeString(data.display_name, walletHint),
      whale_score: safeNumber(data.whale_score, 0),
      stats: {
        total_volume: safeNumber(statsRaw.total_volume, 0),
        total_trades: safeNumber(statsRaw.total_trades, 0),
        win_rate: safeNumber(statsRaw.win_rate, 0),
        realized_pnl: safeNumber(statsRaw.realized_pnl, 0),
      },
      performance_30d: {
        pnl: safeNumber(perfRaw.pnl, 0),
        win_rate: safeNumber(perfRaw.win_rate, 0),
        volume: safeNumber(perfRaw.volume, 0),
      },
    };
  }

  return {
    wallet: safeString(data.wallet, walletHint),
    display_name: safeString(data.display_name, walletHint),
    whale_score: safeNumber(data.whale_score, 0),
    stats: {
      total_volume: safeNumber(data.total_volume, 0),
      total_trades: safeNumber(data.total_trades, 0),
      win_rate: safeNumber(data.win_rate, 0),
      realized_pnl: safeNumber(data.realized_pnl, 0),
    },
    performance_30d: {
      pnl: 0,
      win_rate: 0,
      volume: 0,
    },
  };
}

async function fetchShareDataUncached(wallet: string): Promise<WhaleShareData | null> {
  const base = WHALE_ENGINE_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}/whales/${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return null;
  }
  const payload = await res.json().catch(() => null);
  return normalizeShareData(payload, wallet);
}

const fetchShareDataCached = unstable_cache(fetchShareDataUncached, ['whale-share'], {
  revalidate: 30,
});

const fetchShareData = cache((wallet: string) => fetchShareDataCached(wallet));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wallet } = await params;
  const data = await fetchShareData(wallet);
  const name = data?.display_name || shortenWallet(wallet);
  const title = `${name} Whale Performance Card`;
  const description = `Whale Score and performance snapshot for ${name} on Polymarket.`;
  const ogImage = `${SITE_BASE.replace(/\/$/, '')}/whales/${encodeURIComponent(wallet)}/share/opengraph-image`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_BASE.replace(/\/$/, '')}/whales/${encodeURIComponent(wallet)}/share`,
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
    alternates: {
      canonical: `/whales/${wallet}/share`,
    },
  };
}

export default async function WhaleSharePage({ params }: PageProps) {
  const { wallet } = await params;
  const data = await fetchShareData(wallet);
  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-lg font-semibold text-white">Whale data unavailable</div>
          <div className="text-xs text-gray-400 mt-2">Please refresh or view the full profile.</div>
          <Link
            href={`/whales/${encodeURIComponent(wallet)}`}
            className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-gray-100 hover:bg-white/10 mt-4"
          >
            Open full profile
          </Link>
        </div>
      </div>
    );
  }

  const shareUrl = `${SITE_BASE.replace(/\/$/, '')}/whales/${encodeURIComponent(data.wallet)}/share`;
  const shareText = `Whale ${data.display_name} · Score ${safeNumber(data.whale_score, 0).toFixed(1)} · 30D PnL ${formatUsd(data.performance_30d.pnl)}`;
  const shareX = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const shareTelegram = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-white/5 to-cyan-500/10 p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Whale Performance</p>
              <h1 className="text-3xl font-bold text-white mt-3">{data.display_name}</h1>
              <div className="text-xs text-gray-400 mt-2 font-mono">{shortenWallet(data.wallet)}</div>
            </div>
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-center">
              <div className="text-xs uppercase tracking-wide text-violet-200">Whale Score</div>
              <div className="text-2xl font-semibold text-white mt-1">{safeNumber(data.whale_score, 0).toFixed(1)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">30D PnL</div>
              <div className="text-xl font-semibold text-white mt-2">{formatUsd(data.performance_30d.pnl)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">30D Win Rate</div>
              <div className="text-xl font-semibold text-white mt-2">
                {formatWinRate(data.performance_30d.win_rate, {
                  volume: data.performance_30d.volume,
                  pnl: data.performance_30d.pnl,
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">30D Volume</div>
              <div className="text-xl font-semibold text-white mt-2">{formatUsd(data.performance_30d.volume)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-400">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-gray-500">Total Volume</div>
              <div className="text-white text-base mt-1">{formatUsd(data.stats.total_volume)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-gray-500">All-time Win Rate</div>
              <div className="text-white text-base mt-1">
                {formatWinRate(data.stats.win_rate, {
                  trades: data.stats.total_trades,
                  pnl: data.stats.realized_pnl,
                })}
              </div>
            </div>
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
            href={`/whales/${encodeURIComponent(data.wallet)}`}
            className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
          >
            Open full profile
          </Link>
        </div>
      </div>
    </div>
  );
}
