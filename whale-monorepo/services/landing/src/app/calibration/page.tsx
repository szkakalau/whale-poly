import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

export const revalidate = 300; // Calibration data refreshes every 5 minutes

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

type ScoreTier = {
  tier: string;
  labelName: string;
  count: number;
  resolvedCount: number;
  winRate: number | null;
  avgRoi: number | null;
};

type StarWhale = {
  walletMasked: string;
  totalPnl: number;
  roi: number;
  winRate: number;
  whaleScore: number;
  totalTrades: number;
};

type HomeStats = {
  historyTotal: number;
  scoreTiers: ScoreTier[];
  starWhale: StarWhale | null;
};

const loadStats = unstable_cache(
  async (): Promise<HomeStats | null> => {
    try {
      const res = await fetch(`${API_BASE}/stats/home`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      return (await res.json()) as HomeStats;
    } catch {
      return null;
    }
  },
  ['calibration-page-v1'],
  { revalidate: 300 },
);

export const metadata = {
  title: { absolute: 'Whale Score Calibration — SightWhale.com' },
  description:
    'Live calibration of the SightWhale Whale Score: win rates and average ROI per score band, computed from settled Polymarket alerts. Every signal is auditable on our public history.',
  openGraph: {
    title: 'Whale Score Calibration — SightWhale.com',
    description:
      'Win rates and average ROI per Whale Score band, computed from settled Polymarket alerts.',
    type: 'website',
    url: 'https://www.sightwhale.com/calibration',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  alternates: { canonical: '/calibration' },
};

const TIER_BANDS: Record<string, string> = {
  elite: '90–100',
  high: '80–89',
  med: '70–79',
  base: '0–69',
};

function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

export default async function CalibrationPage() {
  const data = await loadStats();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'SightWhale Whale Score Calibration',
    description:
      'Win rates and average ROI per Whale Score band, computed from settled Polymarket whale alerts.',
    url: 'https://www.sightwhale.com/calibration',
    creator: { '@type': 'Organization', name: 'SightWhale', url: 'https://www.sightwhale.com' },
    distribution: { '@type': 'DataDownload', contentUrl: 'https://www.sightwhale.com/history' },
    temporalCoverage: '2026',
  };

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        <BreadcrumbListScript items={[{ name: 'Calibration', url: '/calibration' }]} />

        <header className="mb-10">
          <p className="eyebrow mb-4">Public calibration report</p>
          <h1 className="text-balance mb-6">Whale Score calibration</h1>
          <p className="text-base sm:text-lg text-muted max-w-2xl leading-relaxed mb-6">
            Every SightWhale alert carries a Whale Score (0–100). This page shows how those
            scores have actually performed — win rate and average ROI per score band, computed
            from settled signals only. If a score band stops predicting outcomes, the numbers
            here will show it. That&apos;s the point.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/methodology" className="btn-secondary inline-flex items-center gap-2">
              Read the scoring methodology
            </Link>
            <Link href="/history" className="btn-secondary inline-flex items-center gap-2">
              View the audited signal history
            </Link>
          </div>
        </header>

        {!data ? (
          <div className="rounded-xl bg-surface card-shadow px-6 py-10 text-center text-muted">
            Calibration data is temporarily unavailable. Please check back shortly.
          </div>
        ) : (
          <>
            {/* ── Summary row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="rounded-xl bg-surface card-shadow px-6 py-5">
                <p className="text-sm text-muted">Total signals published</p>
                <p className="stat-number mt-1">{data.historyTotal.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-surface card-shadow px-6 py-5">
                <p className="text-sm text-muted">Score bands tracked</p>
                <p className="stat-number mt-1">{data.scoreTiers.length}</p>
              </div>
              <div className="rounded-xl bg-surface card-shadow px-6 py-5">
                <p className="text-sm text-muted">Refresh cadence</p>
                <p className="stat-number mt-1">5 min</p>
              </div>
            </div>

            {/* ── Tier table ── */}
            <div className="rounded-xl bg-surface card-shadow overflow-x-auto mb-10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-6 py-4 font-medium">Score band</th>
                    <th className="px-6 py-4 font-medium">Conviction label</th>
                    <th className="px-6 py-4 font-medium text-right">Signals</th>
                    <th className="px-6 py-4 font-medium text-right">Settled</th>
                    <th className="px-6 py-4 font-medium text-right">Win rate</th>
                    <th className="px-6 py-4 font-medium text-right">Avg ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scoreTiers.map((t) => (
                    <tr key={t.tier} className="border-b border-border/50 last:border-0">
                      <td className="px-6 py-4 tabular-nums text-foreground">{TIER_BANDS[t.tier] ?? t.tier}</td>
                      <td className="px-6 py-4">{t.labelName}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{t.count.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{t.resolvedCount.toLocaleString()}</td>
                      <td className={`px-6 py-4 text-right tabular-nums font-semibold ${t.winRate != null && t.winRate >= 0.5 ? 'text-accent' : ''}`}>
                        {formatPct(t.winRate)}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">{formatPct(t.avgRoi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Interpretation + disclaimer ── */}
            <div className="rounded-xl bg-surface card-shadow px-6 py-6 sm:px-8 mb-10">
              <h2 className="text-lg font-semibold mb-3">How to read this</h2>
              <ul className="list-disc list-inside text-sm text-muted space-y-2 leading-relaxed">
                <li>
                  <span className="text-foreground">Win rate</span> is the share of settled signals
                  in the band whose trade direction was profitable (realized PnL ≥ $0.01).
                </li>
                <li>
                  <span className="text-foreground">Avg ROI</span> is the mean of
                  realized PnL ÷ trade size across settled signals in the band.
                </li>
                <li>
                  Bands with small settled counts are statistically noisy — treat a 3-for-5 record
                  very differently from a 400-for-600 record.
                </li>
                <li>
                  A score is calibrated when higher bands consistently show higher win rates and
                  ROI than lower bands. We publish the numbers regardless.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-accent/20 bg-accent/5 px-6 py-5 text-sm text-muted leading-relaxed">
              Past performance does not guarantee future results. Polymarket trading involves risk,
              and these statistics describe historical settled signals — they are decision support,
              not investment advice.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
