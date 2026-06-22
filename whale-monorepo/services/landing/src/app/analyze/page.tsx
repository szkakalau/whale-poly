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
  bullish: { icon: ArrowUpRight, label: 'BULLISH', ring: 'ring-emerald-300/50', text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  bearish: { icon: ArrowDownRight, label: 'BEARISH', ring: 'ring-red-300/50', text: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
  neutral: { icon: Minus, label: 'NEUTRAL', ring: 'ring-muted/30', text: 'text-muted', bg: 'bg-surface-hover/50', dot: 'bg-muted' },
  mixed:   { icon: AlertTriangle, label: 'MIXED', ring: 'ring-amber-300/50', text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
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
    <div className="min-h-screen font-mono text-foreground selection:bg-accent-sharp/30">
      {/* Fixed background structure */}
      <div className="fixed inset-0 -z-10 bg-background" aria-hidden>
      </div>

      {/* Main layout — brutalist 3-column grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Top bar: status line */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border-muted text-[11px] uppercase tracking-[0.25em] text-muted/70">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              SYS.ONLINE
            </span>
            <span className="text-border-muted">|</span>
            <span>SIGHTWHALE//ANALYZE</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span suppressHydrationWarning>{new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
            <span className="text-border-muted">|</span>
            <span>MKTS:{trending.length}</span>
          </div>
        </div>

        {/* Two-column layout: main + sidebar */}
        <div className="grid gap-8 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">
          {/* ── LEFT COLUMN: Search + Results ── */}
          <div>
            {/* Search — monospace, raw */}
            <form onSubmit={handleSubmit} className="mb-10" role="search" aria-label="Market analysis search">
              <label htmlFor="market-query" className="block text-[10px] uppercase tracking-[0.3em] text-muted/60 mb-3 font-semibold">
                Market Query
              </label>
              <div className="flex gap-0 border border-border-muted focus-within:border-accent-sharp/40 transition-colors">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted/60 pointer-events-none" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    id="market-query"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="> paste link or keyword…"
                    className="w-full bg-transparent pl-9 pr-4 py-3.5 text-sm font-mono text-foreground placeholder:text-muted/50 focus:outline-none"
                    disabled={loading}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="shrink-0 bg-accent-sharp px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.2em] hover:opacity-90 disabled:opacity-40 transition-opacity"
                  aria-label={loading ? 'Analyzing…' : 'Run Analysis'}
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    'Run'
                  )}
                </button>
              </div>
            </form>

            {/* Screen reader announcement */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">{analysisText}</div>

            {/* Loading */}
            {loading && (
              <div className="space-y-4 animate-pulse" aria-busy="true">
                <div className="h-20 bg-surface/30 border border-border-muted" />
                <div className="h-10 w-3/4 bg-surface/20" />
                <div className="h-6 w-1/2 bg-surface/20" />
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="border border-red-300 bg-red-50 rounded-lg p-6 mb-8" role="alert">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-red-600 font-bold mb-1">ERR:NO_MATCH</p>
                    <p className="text-xs text-muted">{error}</p>
                  </div>
                </div>
                {result?.candidates && result.candidates.length > 0 && (
                  <nav className="mt-4 pt-4 border-t border-red-200" aria-label="Candidate markets">
                    <p className="text-[9px] uppercase tracking-[0.25em] text-muted/60 mb-2">DID YOU MEAN</p>
                    <ul className="space-y-1">
                      {result.candidates.slice(0, 3).map((c) => (
                        <li key={c.slug}>
                          <button
                            onClick={() => { setQuery(c.title); search(c.title); }}
                            className="block w-full text-left text-xs font-mono text-foreground/80 hover:text-foreground hover:bg-surface/30 px-2 py-1.5 transition-colors"
                          >
                            {c.title}
                            {c.volume24h ? <span className="text-muted/60 ml-2">${(c.volume24h / 1000).toFixed(0)}k</span> : null}
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
                {/* DIRECTION — brutalist verdict box */}
                {(() => {
                  const d = DIR[result.direction] || DIR.neutral;
                  const Icon = d.icon;
                  return (
                    <div
                      className={`border ${d.ring} ring-1 ${d.bg} p-5 sm:p-6`}
                      role="status"
                      aria-label={`Direction: ${d.label}. Confidence: ${result.confidenceScore} out of 100.`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4 min-w-0">
                          <Icon className={`w-7 h-7 ${d.text} shrink-0`} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.3em] text-muted/60 mb-0.5 font-semibold">
                              {result.matchMethod === 'url' ? 'URL MATCH' : 'GAMMA SEARCH'} · SIGNAL
                            </p>
                            <p className={`font-mono text-xl sm:text-2xl font-black tracking-tight ${d.text}`}>
                              {d.label}
                            </p>
                            <p className="text-[10px] text-muted/50 mt-0.5 truncate font-mono">
                              {result.marketTitle || result.marketSlug}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] uppercase tracking-[0.25em] text-muted/60 mb-0.5 font-semibold">CONFIDENCE</p>
                          <p className="font-mono text-3xl font-black text-foreground tabular-nums">
                            {result.confidenceScore}
                          </p>
                          <p className="text-[9px] uppercase tracking-[0.2em] text-muted/60 mt-0.5">{result.confidenceLevel}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* METRICS — 4-col stat grid */}
                <div className="grid grid-cols-4 border border-border-muted">
                  {[
                    { label: 'VOL YES', value: `$${(result.yesVolumeUsd / 1000).toFixed(0)}k`, cls: 'text-emerald-700' },
                    { label: 'VOL NO', value: `$${(result.noVolumeUsd / 1000).toFixed(0)}k`, cls: 'text-red-600' },
                    { label: 'TRADES', value: String(result.whaleTradeCount), cls: 'text-foreground' },
                    { label: 'STALE', value: result.dataFreshness.stalenessMinutes < 60 ? `${result.dataFreshness.stalenessMinutes}m` : `${Math.floor(result.dataFreshness.stalenessMinutes / 60)}h`, cls: 'text-foreground' },
                  ].map((s, i) => (
                    <div key={s.label} className={`px-3 py-3 text-center ${i < 3 ? 'border-r border-border-muted' : ''}`}>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted/50 font-semibold mb-1">{s.label}</p>
                      <p className={`font-mono text-sm font-black tabular-nums ${s.cls}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Partial data warning */}
                {result.partialData && (
                  <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 px-3.5 py-2.5" role="alert">
                    <ShieldAlert className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="text-[10px] text-amber-700 font-mono">
                      Some wallet data unavailable. Analysis based on available data.
                    </p>
                  </div>
                )}

                {/* WALLET BLOTTER */}
                {result.topWallets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="w-3.5 h-3.5 text-muted/60" aria-hidden="true" />
                      <p className="text-[9px] uppercase tracking-[0.3em] text-muted/60 font-bold">Wallet Blotter</p>
                    </div>
                    <div className="border border-border-muted overflow-x-auto">
                      <table className="w-full text-xs font-mono" aria-label="Wallet activity table">
                        <thead>
                          <tr className="border-b border-border-muted text-[9px] uppercase tracking-[0.2em] text-muted/50">
                            <th className="text-left px-3 py-2 font-semibold">Address</th>
                            <th className="text-left px-3 py-2 font-semibold w-16">Side</th>
                            <th className="text-right px-3 py-2 font-semibold w-20">Size</th>
                            <th className="text-right px-3 py-2 font-semibold w-16">Wt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-muted">
                          {result.topWallets.map((w, i) => (
                            <tr key={`${w.addressShort}-${i}`} className="hover:bg-surface/20 transition-colors">
                              <td className="px-3 py-2.5">
                                <span className="tabular-nums">{w.addressShort}</span>
                                {w.categoryStats && w.categoryStats.length > 0 && (
                                  <div className="flex gap-1.5 mt-1">
                                    {w.categoryStats.slice(0, 2).map((cs) => (
                                      <span
                                        key={cs.category}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold border ${
                                          cs.winRate >= 0.6
                                            ? 'border-emerald-300 text-emerald-700'
                                            : 'border-border-muted text-muted/60'
                                        }`}
                                      >
                                        {cs.category}
                                        <span className="tabular-nums">{(cs.winRate * 100).toFixed(0)}%</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`font-bold ${w.outcome === 'YES' ? 'text-emerald-700' : w.outcome === 'NO' ? 'text-red-600' : 'text-muted/60'}`}>
                                  {w.action}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-muted/70">
                                ${(w.amountUsd / 1000).toFixed(0)}k
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-muted/50">
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
                <div className="space-y-1.5">
                  {result.whaleTradeCount < 3 && (
                    <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2" role="alert">
                      <ShieldAlert className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                      <p className="text-[10px] text-amber-600 font-mono">
                        WARN: Only {result.whaleTradeCount} trade(s) in window. Low signal quality.
                      </p>
                    </div>
                  )}
                  {result.dataFreshness.stalenessMinutes > 360 && (
                    <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2" role="alert">
                      <Clock className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                      <p className="text-[10px] text-amber-600 font-mono">
                        WARN: Data stale ({Math.floor(result.dataFreshness.stalenessMinutes / 60)}h old).
                      </p>
                    </div>
                  )}
                  {result.direction === 'mixed' && (
                    <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2" role="alert">
                      <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                      <p className="text-[10px] text-amber-600 font-mono">
                        WARN: Divided signals. No consensus.
                      </p>
                    </div>
                  )}
                </div>

                {/* Disclaimer */}
                <p className="text-[9px] text-muted/50 font-mono border-t border-border-muted pt-3">
                  {result.disclaimer}
                </p>
              </div>
            )}

            {/* Empty result */}
            {result && result.whaleTradeCount === 0 && !error && (
              <div className="border border-dashed border-border-muted p-6 sm:p-8" role="region" aria-label="No whale activity">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 border border-border-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Search className="w-3.5 h-3.5 text-muted/50" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted/60 font-bold mb-1">NO SIGNAL</p>
                    <p className="text-xs font-mono text-muted/60 mb-4">
                      {result.message || 'No whale trades ≥ $5k matched this market in the past 24 hours. This may reflect no qualifying activity, delayed ingestion, or a market-slug mismatch.'}
                    </p>
                    {activeTrending.length > 0 && (
                      <div className="pt-3 border-t border-border-muted">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted/50 mb-2 font-bold">Active Markets</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeTrending.slice(0, 6).map((m) => (
                            <button
                              key={m.slug}
                              onClick={() => { setQuery(m.title); search(m.title); }}
                              className="inline-flex items-center gap-1 border border-border-muted px-2 py-1 text-[10px] font-mono text-muted/50 hover:text-foreground hover:border-accent-sharp/30 transition-colors"
                            >
                              {m.title.length > 45 ? `${m.title.slice(0, 45)}…` : m.title}
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
            <div className="sticky top-20 space-y-6">
              {/* Status panel */}
              <div className="border border-border-muted p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-3 h-3 text-muted/50" aria-hidden="true" />
                  <p className="text-[9px] uppercase tracking-[0.3em] text-muted/60 font-bold">Market Feed</p>
                </div>
                {activeTrending.length > 0 ? (
                  <div className="space-y-0.5">
                    {activeTrending.slice(0, 8).map((m, i) => {
                      const d = DIR[m.direction as keyof typeof DIR] || DIR.neutral;
                      return (
                        <button
                          key={m.slug}
                          onClick={() => { setQuery(m.title); search(m.title); }}
                          className="w-full text-left group hover:bg-surface/20 px-2 py-2 -mx-2 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-mono text-foreground/70 group-hover:text-foreground truncate transition-colors">
                                {m.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] uppercase tracking-wider font-bold ${d.text}`}>
                                  {d.label}
                                </span>
                                <span className="text-[10px] text-muted/50 tabular-nums">{m.confidenceScore}/100</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[9px] font-mono font-bold text-foreground/60 tabular-nums">
                                ${(m.volume24h / 1000).toFixed(0)}k
                              </p>
                              <p className="text-[9px] text-muted/50">{m.whaleTradeCount}t</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : trendingLoading ? (
                  <p className="text-[10px] font-mono text-muted/50">Loading market data…</p>
                ) : (
                  <p className="text-[10px] font-mono text-muted/60">No trending markets available</p>
                )}
              </div>

              {/* Quick help */}
              <div className="border border-border-muted p-4">
                <p className="text-[9px] uppercase tracking-[0.3em] text-muted/60 font-bold mb-3">Usage</p>
                <div className="space-y-2 text-[10px] font-mono text-muted/60">
                  <p><span className="text-muted/60">{'>'}</span> Paste a Polymarket URL</p>
                  <p><span className="text-muted/60">{'>'}</span> Type a keyword (e.g. Trump, BTC)</p>
                  <p><span className="text-muted/60">{'>'}</span> Chinese queries auto-translate</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
