import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Params = {
  params: { id: string };
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

async function loadSummary(id: string) {
  const collection = await prisma.smartCollection.findUnique({
    where: { id },
    include: {
      whales: {
        orderBy: { snapshotDate: 'desc' },
        take: 100,
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
      : collection.whales.filter(
          (w) => w.snapshotDate.getTime() === latestSnapshot.getTime(),
        );
  const wallets = whales.map((w) => w.wallet);
  let stats: { wallet_address: string; volume: number; profit: number; roi: number }[] = [];
  if (wallets.length > 0) {
    stats = await prisma.$queryRawUnsafe<
      { wallet_address: string; volume: number; profit: number; roi: number; ord: number }[]
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
  return {
    name: collection.name,
    description: collection.description ?? '',
    totalProfit,
    totalVolume,
    avgRoi,
    activeWallets: whalesWithStats.length,
  };
}

export default async function OpenGraphImage({ params }: Params) {
  const summary = await loadSummary(params.id);
  const name = summary?.name || 'Smart Collection';
  const desc = summary?.description || 'Curated smart money signals';
  const totalProfit = summary?.totalProfit ?? 0;
  const totalVolume = summary?.totalVolume ?? 0;
  const avgRoi = summary?.avgRoi ?? 0;
  const activeWallets = summary?.activeWallets ?? 0;

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
          background: 'linear-gradient(135deg, rgba(8,10,20,1) 0%, rgba(10,16,32,1) 45%, rgba(12,8,26,1) 100%)',
          color: '#fff',
          fontFamily: 'Arial',
        }}
      >
        <div>
          <div style={{ fontSize: 16, letterSpacing: 2, color: '#a1a1aa' }}>
            SMART COLLECTION
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, marginTop: 16 }}>{name}</div>
          <div style={{ fontSize: 18, marginTop: 10, color: '#cbd5f5' }}>{desc}</div>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: 'Total Profit', value: formatUsd(totalProfit), color: totalProfit >= 0 ? '#34d399' : '#fb7185' },
            { label: 'Avg ROI', value: `${(avgRoi * 100).toFixed(2)}%`, color: '#f8fafc' },
            { label: 'Total Volume', value: formatUsd(totalVolume), color: '#f8fafc' },
            { label: 'Active Wallets', value: activeWallets.toLocaleString(), color: '#f8fafc' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                padding: '18px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div style={{ fontSize: 13, letterSpacing: 1, color: '#94a3b8' }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 10, color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8' }}>
          <span>SightWhale · Polymarket Smart Money</span>
          <span>Snapshot-based smart collection summary</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
