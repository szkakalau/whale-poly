'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { getVwMetricsApi, VwMetricsRow } from '@/lib/vw-client';
import { LocaleProvider, useLocale } from '@/lib/vw-i18n';
import MarketCard from './MarketCard';
import DetailDrawer from './DetailDrawer';

const SORT_OPTIONS = ['volume', 'divergence', 'strength'] as const;

function PageContent() {
  const { t, locale, setLocale } = useLocale();
  const [markets, setMarkets] = useState<VwMetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'divergence' | 'strength'>('volume');
  const [selected, setSelected] = useState<VwMetricsRow | null>(null);

  useEffect(() => {
    setLoading(true);
    getVwMetricsApi(sortBy)
      .then(setMarkets)
      .finally(() => setLoading(false));
  }, [sortBy]);

  const sortLabels: Record<string, string> = {
    volume: t('sort.volume'),
    divergence: t('sort.divergence'),
    strength: t('sort.strength'),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={22} className="text-emerald-500" />
              {t('page.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('page.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium
                       bg-white border border-gray-200 text-gray-600
                       hover:border-gray-300 transition-colors duration-200 ease-out"
          >
            {locale === 'en' ? '中文' : 'EN'}
          </button>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 mb-4">
          {SORT_OPTIONS.map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out
                ${sortBy === key ? 'bg-accent text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:border-accent hover:text-accent'}`}
            >
              {sortLabels[key]}
            </button>
          ))}
        </div>

        {/* Market list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
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
