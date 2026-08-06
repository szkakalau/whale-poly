'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import dynamic from 'next/dynamic';
import PredictionGauge from '@/components/PredictionGauge';
import SignalBreakdown from '@/components/SignalBreakdown';
import type { FusionResult } from '@/lib/prediction-fusion';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

// Lazy-load Kelly card — Elite-only, and rarely shown
const KellyPositionCard = dynamic(() => import('@/components/KellyPositionCard'), { ssr: false });

type Plan = 'free' | 'PRO' | 'ELITE';

// ── Page ─────────────────────────────────────────────────

export default function AnalyzePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMarket = searchParams.get('market') || '';

  const [marketInput, setMarketInput] = useState(initialMarket);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<FusionResult | null>(null);
  const [plan, setPlan] = useState<Plan>('free');
  const [error, setError] = useState<string | null>(null);

  // Load plan on mount
  useEffect(() => {
    fetch('/api/me/plan')
      .then(r => r.json().catch(() => ({})))
      .then(d => setPlan(d.plan || 'free'))
      .catch(() => setPlan('free'));
  }, []);

  // Auto-fetch if market in URL
  useEffect(() => {
    if (initialMarket) {
      doFetch(initialMarket);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMarket]);

  const doFetch = useCallback(async (slug: string) => {
    const trimmed = slug.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const r = await fetch(`/api/prediction?market=${encodeURIComponent(trimmed)}`);
      const data = await r.json();

      if (!r.ok) {
        setError(data.error || 'Failed to load prediction');
        setPrediction(null);
        return;
      }

      if (data.prediction) {
        setPrediction(data.prediction);
      } else {
        setPrediction(null);
        setError(data.message || 'No whale trades found for this market.');
      }
    } catch {
      setError('Network error. Please try again.');
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = marketInput.trim();
    if (!trimmed) return;
    // Update URL without full navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set('market', trimmed);
    router.replace(`/analyze?${params.toString()}`, { scroll: false });
    doFetch(trimmed);
  }

  const isPaid = plan === 'PRO' || plan === 'ELITE';
  const isElite = plan === 'ELITE';
  const polymarketUrl = marketInput.trim()
    ? `https://polymarket.com/event/${marketInput.trim()}`
    : null;

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <main className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        <BreadcrumbListScript items={[{ name: 'Analyze', url: '/analyze' }]} />

        {/* Hero */}
        <header className="mb-10">
          <p className="eyebrow mb-3">Market Analysis</p>
          <h1 className="text-balance mb-4">Predictive Signal Fusion</h1>
          <p className="text-sm text-subtle max-w-xl leading-relaxed">
            Enter a Polymarket event slug below. SightWhale fuses whale quality, behavior patterns,
            volume-weighted divergence, and flow direction into a single prediction score.
          </p>
        </header>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" />
              <input
                type="text"
                value={marketInput}
                onChange={e => setMarketInput(e.target.value)}
                placeholder="e.g. will-btc-hit-150k-in-2026"
                className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-shadow"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !marketInput.trim()}
              className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Analyze'
              )}
            </button>
          </div>
          {polymarketUrl && (
            <a
              href={polymarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-subtle hover:text-accent transition-colors"
            >
              View on Polymarket <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </form>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-4">
            <p className="text-sm text-red-500 font-semibold">{error}</p>
            {!isPaid && (
              <p className="text-xs text-subtle mt-1.5">
                Free tier shows basic flow + behavior predictions.{' '}
                <Link href="/pricing" className="text-accent hover:text-accent-hover font-semibold underline">
                  Upgrade for full fusion.
                </Link>
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!prediction && !loading && !error && (
          <div className="rounded-xl bg-surface card-shadow px-6 py-12 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 mb-5">
              <Search className="w-7 h-7 text-accent" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground mb-2">Enter a market to analyze</p>
            <p className="text-xs text-subtle max-w-md mx-auto leading-relaxed">
              Paste a Polymarket event slug (the part after <code className="text-[11px] text-muted">/event/</code> in the URL)
              to see whale-driven prediction signals.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !prediction && (
          <div className="rounded-xl bg-surface card-shadow px-6 py-10 space-y-6 animate-pulse">
            <div className="flex items-center gap-6">
              <div className="w-[140px] h-[140px] rounded-full bg-foreground/5" />
              <div className="space-y-3 flex-1">
                <div className="h-5 w-24 rounded bg-foreground/5" />
                <div className="h-4 w-40 rounded bg-foreground/5" />
                <div className="h-4 w-32 rounded bg-foreground/5" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-foreground/5" />
              ))}
            </div>
          </div>
        )}

        {/* Prediction result */}
        {prediction && (
          <div className="space-y-6">
            {/* ── Fusion result card ── */}
            <section className="rounded-xl bg-surface card-shadow px-5 sm:px-8 py-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-foreground">Signal Fusion</h2>
                {!isPaid && (
                  <Link
                    href="/pricing"
                    className="text-[10px] font-semibold text-accent hover:text-accent-hover border border-accent/30 rounded-full px-3 py-1 transition-colors"
                  >
                    Unlock Full →
                  </Link>
                )}
              </div>

              {/* Desktop: ring gauge */}
              <div className="hidden sm:block">
                <PredictionGauge prediction={prediction} />
              </div>
              {/* Mobile: progress bar */}
              <div className="sm:hidden">
                <PredictionGauge prediction={prediction} compact />
              </div>

              {/* Signal breakdown */}
              <div className="mt-6 pt-6 border-t border-border-muted">
                <SignalBreakdown
                  components={prediction.signalComponents}
                  agreementScore={prediction.agreementScore}
                  isLocked={!isPaid}
                />
              </div>
            </section>

            {/* ── Kelly sizing (Elite only) ── */}
            {isElite && (
              <section>
                <KellyPositionCard
                  result={{
                    winProbability: 0.6,
                    avgWinRoi: 0.25,
                    avgLossRoi: 0.10,
                    winLossRatio: 2.5,
                    kellyFraction: 0.44,
                    halfKellyFraction: 0.22,
                    quarterKellyFraction: 0.11,
                    recommendedFraction: 0.22,
                    edge: 0.14,
                    sampleSize: 50,
                    confidence: 'high',
                    suggestion: '基于 50 笔历史交易，推荐 Half-Kelly 仓位 22.0%。',
                  }}
                  score={prediction.compositeScore}
                  marketSlug={prediction.marketSlug}
                />
              </section>
            )}

            {/* Non-Elite: locked Kelly teaser */}
            {isPaid && !isElite && (
              <div className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-4 text-center">
                <p className="text-xs text-subtle">
                  <span className="font-semibold text-muted">Kelly Position Sizing</span> — Elite plan unlocks
                  optimal position size recommendations based on historical edge.{' '}
                  <Link href="/pricing" className="text-accent hover:text-accent-hover font-semibold underline">
                    Upgrade →
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
