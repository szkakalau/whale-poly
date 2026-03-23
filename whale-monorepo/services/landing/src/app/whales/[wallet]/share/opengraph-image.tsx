import { ImageResponse } from 'next/og';

// Use node runtime to keep static generation available during builds.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';

type WhaleProfileResponse = {
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

type Params = {
  params: { wallet: string };
};

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

function formatWinRate(value: number, opts?: { pnl?: number; volume?: number }): string {
  if (!Number.isFinite(value)) return '—';
  const pnl = opts?.pnl;
  const volume = opts?.volume;
  if (value === 0) {
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

async function fetchWhaleProfile(wallet: string): Promise<WhaleProfileResponse | null> {
  const base = WHALE_ENGINE_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}/whales/${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as WhaleProfileResponse;
}

export default async function OpenGraphImage({ params }: Params) {
  const data = await fetchWhaleProfile(params.wallet);
  const name = data?.display_name || shortenWallet(params.wallet);
  const wallet = data?.wallet || params.wallet;
  const score = data?.whale_score ?? 0;
  const pnl30d = data?.performance_30d?.pnl ?? 0;
  const win30d = data?.performance_30d?.win_rate ?? 0;
  const vol30d = data?.performance_30d?.volume ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          background: 'linear-gradient(135deg, rgba(12,12,18,1) 0%, rgba(10,6,24,1) 45%, rgba(8,18,26,1) 100%)',
          color: '#fff',
          fontFamily: 'Arial',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, letterSpacing: 2, color: '#a1a1aa' }}>
              WHALE PERFORMANCE CARD
            </div>
            <div style={{ fontSize: 46, fontWeight: 700, marginTop: 16 }}>{name}</div>
            <div style={{ fontSize: 18, marginTop: 10, color: '#cbd5f5' }}>
              {shortenWallet(wallet)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 16,
                color: '#a5b4fc',
                padding: '8px 14px',
                borderRadius: 999,
                border: '1px solid rgba(139,92,246,0.5)',
                background: 'rgba(139,92,246,0.15)',
                display: 'inline-block',
              }}
            >
              Whale Score {score.toFixed(1)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: '30D PnL', value: formatUsd(pnl30d), color: pnl30d >= 0 ? '#34d399' : '#fb7185' },
            { label: '30D Win Rate', value: formatWinRate(win30d, { pnl: pnl30d, volume: vol30d }), color: '#f8fafc' },
            { label: '30D Volume', value: formatUsd(vol30d), color: '#f8fafc' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                padding: '20px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div style={{ fontSize: 14, letterSpacing: 1, color: '#94a3b8' }}>{item.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10, color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8' }}>
          <span>SightWhale · Polymarket Smart Money</span>
          <span>Share-ready snapshot</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
