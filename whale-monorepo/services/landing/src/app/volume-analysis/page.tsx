'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TrendingUp, Loader2 } from 'lucide-react';
import { getVwMetricsApi, VwMetricsRow } from '@/lib/vw-client';
import { LocaleProvider, useLocale } from '@/lib/vw-i18n';
import MarketCard from './MarketCard';
import DetailDrawer from './DetailDrawer';

const SORT_OPTIONS = ['volume', 'divergence', 'strength'] as const;

/* ── JSON-LD (rendered as a script in the page) ── */

const pageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Volume-Weighted Analysis — SightWhale',
  url: 'https://www.sightwhale.com/volume-analysis',
  description:
    'Discover prediction markets with significant whale volume divergence. Sort by volume, divergence strength, and track smart money flow in real time.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  dateModified: '2026-07-18',
};

function PageContent() {
  const { t, locale, setLocale } = useLocale();
  const [markets, setMarkets] = useState<VwMetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'divergence' | 'strength'>('volume');
  const [selected, setSelected] = useState<VwMetricsRow | null>(null);
  const sortByRef = useRef(sortBy);

  useEffect(() => {
    sortByRef.current = sortBy;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show spinner on sort change
    setLoading(true);
    getVwMetricsApi(sortBy)
      .then((data) => {
        // Only apply if sortBy hasn't changed since request fired
        if (sortByRef.current === sortBy) setMarkets(data);
      })
      .finally(() => {
        if (sortByRef.current === sortBy) setLoading(false);
      });
  }, [sortBy]);

  const sortLabels: Record<string, string> = {
    volume: t('sort.volume'),
    divergence: t('sort.divergence'),
    strength: t('sort.strength'),
  };

  return (
    <div className="min-h-screen">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="eyebrow mb-3">Smart money flow</p>
            <h1 className="text-balance mb-3 flex items-center gap-2">
              <TrendingUp size={24} className="text-accent shrink-0" aria-hidden />
              {t('page.title')}
            </h1>
            <p className="text-sm text-muted max-w-lg leading-relaxed">
              {t('page.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium
                       bg-surface border border-border text-muted
                       hover:border-accent hover:text-accent transition-colors duration-200 ease-out"
          >
            {locale === 'en' ? '中文' : 'EN'}
          </button>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 mb-6">
          {SORT_OPTIONS.map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ease-out
                ${sortBy === key
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface text-muted border border-border hover:border-accent hover:text-accent'
                }`}
            >
              {sortLabels[key]}
            </button>
          ))}
        </div>

        {/* Market list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-muted" size={28} />
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20 text-muted text-sm">
            {t('empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {markets.map((m) => (
              <MarketCard
                key={m.marketId}
                data={m}
                onSelect={() => setSelected(m)}
              />
            ))}
          </div>
        )}

        {/* Freshness indicator + links */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <p className="text-[11px] text-subtle">
            Data refreshes every 60 seconds ·{' '}
            <time dateTime="2026-07-18">Page updated: July 18, 2026</time>
            {' · '}
            <Link href="/methodology" className="text-accent hover:text-accent-hover transition-colors underline decoration-accent/20 underline-offset-2">
              Methodology
            </Link>
          </p>
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer
          market={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export default function VolumeAnalysisPage() {
  return (
    <LocaleProvider>
      <PageContent />
    </LocaleProvider>
  );
}
