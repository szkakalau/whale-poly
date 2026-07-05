'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, ArrowRight, TrendingUp, Wallet, ShieldAlert,
  AlertTriangle, Loader2, ExternalLink, Sparkles, ArrowUpRight,
  ArrowDownRight, Minus, Hash, Clock, BarChart3,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────

type WalletEvidence = {
  addressShort: string;
  action: string;
  amountUsd: number;
  outcome: string;
  walletWeight: number;
  categoryStats?: { category: string; totalTrades: number; winRate: number }[];
};

type Candidate = {
  slug: string;
  title: string;
  volume24h?: number;
};

type TrendingMarket = {
  slug: string;
  title: string;
  volume24h: number;
  direction: string;
  confidenceScore: number;
  confidenceLevel: string;
  whaleTradeCount: number;
};

type AnalysisData = {
  marketSlug: string;
  marketTitle?: string;
  direction: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  confidenceLevel: 'low' | 'medium' | 'high';
  confidenceScore: number;
  whaleTradeCount: number;
  yesVolumeUsd: number;
  noVolumeUsd: number;
  topWallets: WalletEvidence[];
  dataFreshness: { lastUpdated: string; stalenessMinutes: number };
  disclaimer: string;
  matchMethod: 'url' | 'search' | 'none';
  candidates: Candidate[];
  message?: string;
  error?: string;
  partialData?: boolean;
};

// ── Direction helpers ───────────────────────────────

const DIR = {
  bullish: { icon: ArrowUpRight, label: 'Bullish', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  bearish: { icon: ArrowDownRight, label: 'Bearish', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  neutral: { icon: Minus, label: 'Neutral', text: 'text-muted', bg: 'bg-surface', border: 'border-border' },
  mixed:   { icon: AlertTriangle, label: 'Mixed', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
} as const;

// ── Component ────────────────────────────────────────

export default function AnalyzePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trending, setTrending] = useState<TrendingMarket[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [analysisText, setAnalysisText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch('/api/analyze/trending')
      .then((r) => r.json())
      .then((d) => setTrending(d.markets || []))
      .catch(() => {})
      .finally(() => setTrendingLoading(false));

    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
      search(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysisText('');
    try {
      const res = await fetch(`/api/analyze?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.candidates?.length > 0) {
          setResult({ ...data, direction: 'neutral', confidenceLevel: 'low', confidenceScore: 0, whaleTradeCount: 0, topWallets: [], yesVolumeUsd: 0, noVolumeUsd: 0 });
          setError(data.message || 'No match found.');
        } else {
          setError(data.message || 'Analysis failed.');
        }
        return;
      }
      setResult(data);
      if (data.direction && data.confidenceLevel) {
        setAnalysisText(`${data.direction} direction, confidence ${data.confidenceScore}/100 (${data.confidenceLevel}). ${data.whaleTradeCount} whale trades detected.`);
      }
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const activeTrending = trending.filter(m => m.whaleTradeCount > 0);

  // ── Render ─────────────────────────────────────────

  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      {/* ── Header ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-8 sm:pb-12">
        <p className="eyebrow mb-4">Whale Intelligence</p>
        <h1 className="text-balance mb-3">
          Analyze any market
        </h1>
        <p className="text-base text-muted max-w-xl leading-relaxed mb-8">
          Paste a Polymarket link or search by keyword. See what the top 1% of wallets are doing — direction, conviction, and every trade behind it.
        </p>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="max-w-xl" role="search" aria-label="Market analysis search">
          <div className="flex gap-0 rounded-lg border border-border focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-shadow">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" aria-hidden="true" />
              <input
                ref={inputRef}
                id="market-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste Polymarket link or type a keyword…"
                className="w-full bg-transparent pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-subtle focus:outline-none"
                disabled={loading}
                autoComplete="off"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="btn-primary rounded-l-none !rounded-r-lg px-6 min-h-[48px] text-sm"
              aria-label={loading ? 'Analyzing…' : 'Run Analysis'}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span className="ml-2">Analyzing…</span>
                </>
              ) : (
                'Analyze'
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-subtle">
            Try: &ldquo;Trump&rdquo;, &ldquo;BTC&rdquo;, or paste any polymarket.com URL
          </p>
        </form>
      </section>

      {/* ── Initial state: Trending markets before any search ── */}
      {!result && !loading && !error && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Market Feed */}
            <div className="rounded-lg bg-surface card-shadow p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-accent" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Market Feed</p>
              </div>
              {activeTrending.length > 0 ? (
                <div className="space-y-0.5">
                  {activeTrending.slice(0, 6).map((m) => {
                    const d = DIR[m.direction as keyof typeof DIR] || DIR.neutral;
                    return (
                      <button
                        key={m.slug}
                        onClick={() => { setQuery(m.title); search(m.title); }}
                        className="w-full text-left hover:bg-surface-hover px-3 py-2 -mx-3 rounded-md transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs font-semibold ${d.text}`}>{d.label}</span>
                              <span className="text-xs text-subtle tabular-nums">{m.confidenceScore}/100</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-muted tabular-nums">${(m.volume24h / 1000).toFixed(0)}k</p>
                            <p className="text-xs text-subtle">{m.whaleTradeCount}t</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : trendingLoading ? (
                <p className="text-sm text-subtle">Loading market data…</p>
              ) : (
                <p className="text-sm text-subtle">No trending markets available right now.</p>
              )}
            </div>

            {/* How to use */}
            <div className="rounded-lg bg-surface card-shadow p-5 sm:p-6">
              <p className="text-sm font-semibold text-foreground mb-4">How to use</p>
              <div className="space-y-4 text-sm text-muted leading-relaxed">
                <div className="flex gap-3">
                  <span className="text-accent font-semibold shrink-0">1</span>
                  <p>Paste any Polymarket URL to analyze a specific market.</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent font-semibold shrink-0">2</span>
                  <p>Type a keyword like &ldquo;Trump&rdquo; or &ldquo;BTC&rdquo; to search across markets.</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent font-semibold shrink-0">3</span>
                  <p>Chinese queries are auto-translated to English for search.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Results (only shown after a search) ── */}
      {(result || loading || error) && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-6">

              {/* Screen reader announcement */}
              <div className="sr-only" aria-live="polite" aria-atomic="true">{analysisText}</div>

              {/* Loading */}
              {loading && (
                <div className="space-y-4 animate-pulse" aria-busy="true">
                  <div className="h-28 rounded-lg bg-surface card-shadow" />
                  <div className="h-16 rounded-lg bg-surface card-shadow" />
                  <div className="h-48 rounded-lg bg-surface card-shadow" />
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-700 mb-1">No match found</p>
                      <p className="text-sm text-muted">{error}</p>
                    </div>
                  </div>
                  {result?.candidates && result.candidates.length > 0 && (
                    <nav className="mt-4 pt-4 border-t border-red-200" aria-label="Candidate markets">
                      <p className="text-xs font-semibold text-muted mb-2">Did you mean:</p>
                      <ul className="space-y-1">
                        {result.candidates.slice(0, 3).map((c) => (
                          <li key={c.slug}>
                            <button
                              onClick={() => { setQuery(c.title); search(c.title); }}
                              className="block w-full text-left text-sm text-foreground hover:text-accent hover:bg-surface px-2 py-1.5 rounded transition-colors"
                            >
                              {c.title}
                              {c.volume24h ? <span className="text-subtle ml-2">${(c.volume24h / 1000).toFixed(0)}k vol</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  )}
                </div>
              )}

              {/* Results */}
              {result && result.whaleTradeCount > 0 && (
                <div ref={resultsRef} className="space-y-6" role="region" aria-label="Analysis results">
                  {/* DIRECTION VERDICT */}
                  {(() => {
                    const d = DIR[result.direction] || DIR.neutral;
                    const Icon = d.icon;
                    return (
                      <div
                        className={`rounded-lg border ${d.border} ${d.bg} p-6 sm:p-8`}
                        role="status"
                        aria-label={`Direction: ${d.label}. Confidence: ${result.confidenceScore} out of 100.`}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-5 min-w-0">
                            <div className={`w-12 h-12 rounded-full ${d.bg} border ${d.border} flex items-center justify-center shrink-0`}>
                              <Icon className={`w-6 h-6 ${d.text}`} aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-subtle mb-1">
                                {result.matchMethod === 'url' ? 'URL Match' : 'Search Result'}
                              </p>
                              <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${d.text}`}>
                                {d.label}
                              </p>
                              <p className="text-sm text-muted mt-1 truncate">
                                {result.marketTitle || result.marketSlug}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-subtle mb-1">Confidence</p>
                            <p className="text-4xl font-bold text-foreground tabular-nums stat-number">
                              {result.confidenceScore}
                            </p>
                            <p className="text-xs text-muted mt-0.5 capitalize">{result.confidenceLevel}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* METRICS */}
                  <div className="grid grid-cols-4 rounded-lg bg-surface card-shadow overflow-hidden">
                    {[
                      { label: 'Yes Volume', value: `$${(result.yesVolumeUsd / 1000).toFixed(0)}k`, cls: 'text-emerald-700' },
                      { label: 'No Volume', value: `$${(result.noVolumeUsd / 1000).toFixed(0)}k`, cls: 'text-red-600' },
                      { label: 'Whale Trades', value: String(result.whaleTradeCount), cls: 'text-foreground' },
                      { label: 'Data Age', value: result.dataFreshness.stalenessMinutes < 60 ? `${result.dataFreshness.stalenessMinutes}m` : `${Math.floor(result.dataFreshness.stalenessMinutes / 60)}h`, cls: 'text-foreground' },
                    ].map((s, i) => (
                      <div key={s.label} className={`px-3 py-4 text-center ${i < 3 ? 'border-r border-border' : ''}`}>
                        <p className="text-xs text-subtle mb-1">{s.label}</p>
                        <p className={`text-base font-bold tabular-nums stat-number ${s.cls}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Partial data warning */}
                  {result.partialData && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
                      <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                      <p className="text-sm text-amber-700">
                        Some wallet data unavailable. Analysis based on available data.
                      </p>
                    </div>
                  )}

                  {/* WALLET BLOTTER */}
                  {result.topWallets.length > 0 && (
                    <div className="rounded-lg bg-surface card-shadow overflow-hidden">
                      <div className="px-5 py-4 border-b border-border">
                        <p className="text-sm font-semibold text-foreground">Wallet Activity</p>
                        <p className="text-xs text-subtle mt-0.5">Recent whale trades on this market</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" aria-label="Wallet activity table">
                          <thead>
                            <tr className="border-b border-border text-xs text-subtle">
                              <th className="text-left px-5 py-3 font-medium">Wallet</th>
                              <th className="text-left px-5 py-3 font-medium w-20">Side</th>
                              <th className="text-right px-5 py-3 font-medium w-24">Size</th>
                              <th className="text-right px-5 py-3 font-medium w-16">Wt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {result.topWallets.map((w, i) => (
                              <tr key={`${w.addressShort}-${i}`} className="hover:bg-surface-hover transition-colors">
                                <td className="px-5 py-3">
                                  <span className="tabular-nums text-foreground font-medium">{w.addressShort}</span>
                                  {w.categoryStats && w.categoryStats.length > 0 && (
                                    <div className="flex gap-1.5 mt-1.5">
                                      {w.categoryStats.slice(0, 2).map((cs) => (
                                        <span
                                          key={cs.category}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${
                                            cs.winRate >= 0.6
                                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                              : 'border-border text-muted'
                                          }`}
                                        >
                                          {cs.category}
                                          <span className="tabular-nums">{(cs.winRate * 100).toFixed(0)}%</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`font-semibold text-sm ${w.outcome === 'YES' ? 'text-emerald-700' : w.outcome === 'NO' ? 'text-red-600' : 'text-muted'}`}>
                                    {w.action}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums text-muted">
                                  ${(w.amountUsd / 1000).toFixed(0)}k
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums text-subtle">
                                  {w.walletWeight}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {((result.whaleTradeCount < 3) || (result.dataFreshness.stalenessMinutes > 360) || (result.direction === 'mixed')) && (
                    <div className="space-y-2">
                      {result.whaleTradeCount < 3 && (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
                          <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                          <p className="text-sm text-amber-700">
                            Only {result.whaleTradeCount} trade(s) in window. Low signal quality — interpret with caution.
                          </p>
                        </div>
                      )}
                      {result.dataFreshness.stalenessMinutes > 360 && (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
                          <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                          <p className="text-sm text-amber-700">
                            Data is {Math.floor(result.dataFreshness.stalenessMinutes / 60)} hours old. More recent data may change this analysis.
                          </p>
                        </div>
                      )}
                      {result.direction === 'mixed' && (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                          <p className="text-sm text-amber-700">
                            Divided signals — whales are split on direction. No consensus.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Disclaimer */}
                  <p className="text-xs text-subtle leading-relaxed pt-4 border-t border-border">
                    {result.disclaimer}
                  </p>
                </div>
              )}

              {/* Empty result */}
              {result && result.whaleTradeCount === 0 && !error && (
                <div className="rounded-lg bg-surface card-shadow p-6 sm:p-8" role="region" aria-label="No whale activity">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center shrink-0">
                      <Search className="w-4 h-4 text-subtle" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground mb-1">No whale activity detected</p>
                      <p className="text-sm text-muted leading-relaxed mb-4">
                        {result.message || 'No whale trades ≥ $5k matched this market in the past 24 hours. This may reflect no qualifying activity, delayed ingestion, or a market-slug mismatch.'}
                      </p>
                      {activeTrending.length > 0 && (
                        <div className="pt-4 border-t border-border">
                          <p className="text-xs font-semibold text-subtle mb-3">Try an active market instead</p>
                          <div className="flex flex-wrap gap-2">
                            {activeTrending.slice(0, 6).map((m) => (
                              <button
                                key={m.slug}
                                onClick={() => { setQuery(m.title); search(m.title); }}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent/30 transition-colors"
                              >
                                {m.title.length > 50 ? `${m.title.slice(0, 50)}…` : m.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN: Sidebar ── */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                {/* Market Feed card */}
                <div className="rounded-lg border border-border bg-surface p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-accent" aria-hidden="true" />
                    <p className="text-sm font-semibold text-foreground">Market Feed</p>
                  </div>
                  {activeTrending.length > 0 ? (
                    <div className="space-y-0.5">
                      {activeTrending.slice(0, 8).map((m) => {
                        const d = DIR[m.direction as keyof typeof DIR] || DIR.neutral;
                        return (
                          <button
                            key={m.slug}
                            onClick={() => { setQuery(m.title); search(m.title); }}
                            className="w-full text-left hover:bg-surface-hover px-3 py-2 -mx-3 rounded-md transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-xs font-semibold ${d.text}`}>{d.label}</span>
                                  <span className="text-xs text-subtle tabular-nums">{m.confidenceScore}/100</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-semibold text-muted tabular-nums">${(m.volume24h / 1000).toFixed(0)}k</p>
                                <p className="text-xs text-subtle">{m.whaleTradeCount}t</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  ) : trendingLoading ? (
                    <p className="text-sm text-subtle">Loading market data…</p>
                  ) : (
                    <p className="text-sm text-subtle">No trending markets available</p>
                  )}
                </div>

                {/* Usage tips card */}
                <div className="rounded-lg border border-border bg-surface p-5">
                  <p className="text-sm font-semibold text-foreground mb-3">How to use</p>
                  <div className="space-y-2.5 text-sm text-muted leading-relaxed">
                    <p>Paste any Polymarket URL to analyze a specific market.</p>
                    <p>Type a keyword like &ldquo;Trump&rdquo; or &ldquo;BTC&rdquo; to search across markets.</p>
                    <p>Chinese queries are auto-translated to English for search.</p>
                  </div>
                </div>
              </div>
            </aside>

          </div>
        </div>
      )}
    </div>
  );
}
