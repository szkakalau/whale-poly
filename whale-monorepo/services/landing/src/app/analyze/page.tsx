'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, ArrowRight, TrendingUp, Wallet, ShieldAlert, AlertTriangle, Loader2, ExternalLink, Sparkles } from 'lucide-react';

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

export default function AnalyzePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trending, setTrending] = useState<TrendingMarket[]>([]);
  const [analysisText, setAnalysisText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-focus search + load trending on mount
  useEffect(() => {
    inputRef.current?.focus();
    fetch('/api/analyze/trending')
      .then((r) => r.json())
      .then((d) => setTrending(d.markets || []))
      .catch(() => {});
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
      // Build screen reader announcement
      if (data.direction && data.confidenceLevel) {
        setAnalysisText(`${data.direction} direction, confidence ${data.confidenceScore} out of 100 (${data.confidenceLevel}). ${data.whaleTradeCount} whale trades detected.`);
      }
      // Scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError('⚠️ Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const dirConfig = {
    bullish: { emoji: '🟢', label: 'Bullish', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    bearish: { emoji: '🔴', label: 'Bearish', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    neutral: { emoji: '⚪', label: 'Neutral', bg: 'bg-surface-hover', border: 'border-border' },
    mixed: { emoji: '🟡', label: 'Mixed', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  };

  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-accent-sharp" aria-hidden="true" />
            <p className="text-[11px] font-bold text-accent-sharp tracking-[0.35em] uppercase">
              Decision Engine
            </p>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Polymarket Whale Analysis
          </h1>
          <p className="mt-3 text-sm text-muted max-w-lg leading-relaxed">
            Paste a Polymarket link or type a keyword. Get whale trade direction,
            confidence score, and wallet-level evidence.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-8" role="search" aria-label="Market analysis search">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="market-query" className="sr-only">Market link or keyword</label>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
              <input
                ref={inputRef}
                id="market-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste a link or type a keyword… e.g. BTC 150k"
                className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-sharp/30 focus:border-accent-sharp transition-all"
                disabled={loading}
                autoComplete="off"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-sharp px-5 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              aria-label={loading ? 'Analyzing…' : 'Analyze'}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  Analyze
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Screen reader announcement region */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {analysisText}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-lg border border-border bg-surface/50 p-6 sm:p-8 animate-pulse space-y-4" aria-busy="true" aria-label="Analyzing…">
            <div className="h-6 w-48 bg-surface-hover rounded" />
            <div className="h-4 w-32 bg-surface-hover rounded" />
            <div className="h-4 w-full bg-surface-hover rounded" />
            <div className="h-4 w-3/4 bg-surface-hover rounded" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 sm:p-8 mb-6" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm text-red-300 font-semibold mb-1">Market not recognized</p>
                <p className="text-sm text-muted">{error}</p>
              </div>
            </div>
            {/* Candidates */}
            {result?.candidates && result.candidates.length > 0 && (
              <nav className="mt-4 pt-4 border-t border-border" aria-label="Candidate markets">
                <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wider">Did you mean one of these?</p>
                <ul className="space-y-1.5">
                  {result.candidates.slice(0, 3).map((c) => (
                    <li key={c.slug}>
                      <button
                        onClick={() => { setQuery(c.title); search(c.title); }}
                        className="block w-full text-left text-sm text-foreground hover:bg-surface-hover rounded-md px-3 py-2 transition-colors"
                      >
                        {c.title}
                        {c.volume24h ? (
                          <span className="text-xs text-muted ml-2">
                            ${(c.volume24h / 1000).toFixed(0)}k vol
                          </span>
                        ) : null}
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
          <div ref={resultsRef} className="space-y-5" role="region" aria-label="Analysis results">
            {/* Direction — full-width dominant panel */}
            <div
              className={`rounded-lg border ${dirConfig[result.direction].border} ${dirConfig[result.direction].bg} p-5 sm:p-6`}
              role="status"
              aria-label={`Direction: ${dirConfig[result.direction].label}. Confidence: ${result.confidenceScore} out of 100.`}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <span className="text-3xl" aria-hidden="true">{dirConfig[result.direction].emoji}</span>
                  <div>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-[0.3em] mb-0.5">
                      {result.matchMethod === 'url' ? 'URL match' : 'Gamma API search'} · {result.marketTitle || result.marketSlug}
                    </p>
                    <p className={`font-display text-2xl sm:text-3xl font-black ${dirConfig[result.direction].label === 'Bullish' ? 'text-emerald-400' : dirConfig[result.direction].label === 'Bearish' ? 'text-red-400' : dirConfig[result.direction].label === 'Mixed' ? 'text-amber-400' : 'text-foreground'}`}>
                      {dirConfig[result.direction].label}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-[0.3em] mb-0.5">Confidence</p>
                  <p className="font-display text-2xl font-black text-foreground tabular-nums">
                    {result.confidenceScore}
                    <span className="text-base font-normal text-muted">/100</span>
                  </p>
                  <p className="text-[10px] font-semibold uppercase text-muted mt-0.5">{result.confidenceLevel}</p>
                </div>
              </div>
            </div>

            {/* Volume summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-md border border-border bg-surface px-3 py-2.5">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-0.5">YES Volume</p>
                <p className="text-sm font-black text-emerald-400 tabular-nums">${(result.yesVolumeUsd / 1000).toFixed(0)}k</p>
              </div>
              <div className="rounded-md border border-border bg-surface px-3 py-2.5">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-0.5">NO Volume</p>
                <p className="text-sm font-black text-red-400 tabular-nums">${(result.noVolumeUsd / 1000).toFixed(0)}k</p>
              </div>
              <div className="rounded-md border border-border bg-surface px-3 py-2.5">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-0.5">Whale Trades</p>
                <p className="text-sm font-black text-foreground tabular-nums">{result.whaleTradeCount}</p>
              </div>
              <div className="rounded-md border border-border bg-surface px-3 py-2.5">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-0.5">Data Age</p>
                <p className="text-sm font-black text-foreground tabular-nums">
                  {result.dataFreshness.stalenessMinutes < 60
                    ? `${result.dataFreshness.stalenessMinutes}m`
                    : `${Math.floor(result.dataFreshness.stalenessMinutes / 60)}h`}
                </p>
              </div>
            </div>

            {/* Partial data warning */}
            {result.partialData && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5" role="alert">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-xs text-amber-300">
                  Some wallet data is unavailable — analysis based on available data. Confidence may be affected.
                </p>
              </div>
            )}

            {/* Wallet evidence — semantic table */}
            {result.topWallets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Wallet className="w-4 h-4 text-accent-sharp" aria-hidden="true" />
                  <p className="text-sm font-bold text-foreground" id="wallet-evidence-label">Key Wallet Activity</p>
                </div>
                <table className="w-full text-sm" aria-labelledby="wallet-evidence-label">
                  <thead className="sr-only">
                    <tr>
                      <th>Wallet</th>
                      <th>Action</th>
                      <th>Amount</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted">
                    {result.topWallets.map((w, i) => (
                      <tr key={`${w.addressShort}-${i}`} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="py-2 pr-3">
                          <div>
                            <span className="font-mono text-xs text-foreground">{w.addressShort}</span>
                            {w.categoryStats && w.categoryStats.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {w.categoryStats.slice(0, 2).map((cs) => (
                                  <span
                                    key={cs.category}
                                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                      cs.winRate >= 0.6 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-surface-hover text-muted'
                                    }`}
                                  >
                                    {cs.category}
                                    <span className="tabular-nums">{(cs.winRate * 100).toFixed(0)}%</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`text-xs font-bold ${w.outcome === 'YES' ? 'text-emerald-400' : w.outcome === 'NO' ? 'text-red-400' : 'text-muted'}`}>
                            {w.action === 'BUY' ? 'Buy' : w.action === 'SELL' ? 'Sell' : 'Trade'}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <span className="text-xs text-muted tabular-nums">${(w.amountUsd / 1000).toFixed(0)}k {w.outcome}</span>
                        </td>
                        <td className="py-2 text-right">
                          <span className="font-mono text-[10px] text-muted tabular-nums">w{w.walletWeight}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Warnings */}
            <div className="space-y-2">
              {result.whaleTradeCount < 3 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5" role="alert">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-amber-300">
                    Limited data — only {result.whaleTradeCount} whale trade(s) detected. More data points are needed for a reliable direction signal.
                  </p>
                </div>
              )}
              {result.dataFreshness.stalenessMinutes > 360 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5" role="alert">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-amber-300">
                    Data last updated {Math.floor(result.dataFreshness.stalenessMinutes / 60)} hours ago. May not reflect the latest market activity.
                  </p>
                </div>
              )}
              {result.direction === 'mixed' && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5" role="alert">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-amber-300">Whale signals are divided — no clear consensus. Proceed with caution.</p>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <p className="text-[11px] text-muted/50 pt-3 border-t border-border-muted">
              {result.disclaimer || 'ⓘ Not financial advice. Signals are based on historical data and do not guarantee future results. Trade at your own risk.'}
            </p>
          </div>
        )}

        {/* Empty: no whale trades — with trending guide */}
        {result && result.whaleTradeCount === 0 && !error && (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 p-6 sm:p-8 text-left" role="region" aria-label="No whale activity">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center shrink-0 mt-0.5">
                <Search className="w-5 h-5 text-muted/50" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-foreground font-semibold mb-1">No whale activity detected</p>
                <p className="text-xs text-muted/70 leading-relaxed mb-4">
                  No large whale trades (≥ $5k) were detected for this market in the past 24 hours.
                  Smart money may not have taken a position yet.
                </p>
                {trending.length > 0 && (
                  <div className="border-t border-border-muted pt-3">
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-2">
                      Active markets — try one of these:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {trending.filter(m => m.whaleTradeCount > 0).slice(0, 6).map((m) => (
                        <button
                          key={m.slug}
                          onClick={() => { setQuery(m.title); search(m.title); }}
                          className="inline-flex items-center gap-1 rounded-md border border-border-muted bg-surface px-2.5 py-1.5 text-[11px] text-muted hover:text-foreground hover:border-accent-sharp/40 transition-colors"
                        >
                          <TrendingUp className="w-3 h-3" aria-hidden="true" />
                          {m.title.length > 40 ? `${m.title.slice(0, 40)}...` : m.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Initial empty state + trending */}
        {!result && !loading && !error && (
          <div className="space-y-6">
            <div className="rounded-lg border border-dashed border-border bg-surface/30 p-8 sm:p-10 text-left" role="region" aria-label="Start analysis">
              <div className="max-w-sm">
                <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center mb-4">
                  <TrendingUp className="w-5 h-5 text-muted/40" aria-hidden="true" />
                </div>
                <p className="text-sm text-foreground font-semibold mb-1.5">Enter a market to analyze</p>
                <p className="text-xs text-muted/60 leading-relaxed">
                  Paste a Polymarket link or type a market keyword. We'll analyze whale trade data
                  and return direction, confidence score, and wallet-level evidence.
                </p>
              </div>
            </div>

            {/* Trending markets section */}
            {trending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-accent-sharp" aria-hidden="true" />
                  <p className="text-sm font-bold text-foreground">Trending Now</p>
                  <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Live</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {trending.filter(m => m.whaleTradeCount > 0).slice(0, 8).map((m) => {
                    const dirMap: Record<string, { emoji: string; cls: string }> = {
                      bullish: { emoji: '🟢', cls: 'text-emerald-400' },
                      bearish: { emoji: '🔴', cls: 'text-red-400' },
                      neutral: { emoji: '⚪', cls: 'text-muted' },
                      mixed: { emoji: '🟡', cls: 'text-amber-400' },
                    };
                    const d = dirMap[m.direction] || dirMap.neutral;
                    return (
                      <button
                        key={m.slug}
                        onClick={() => { setQuery(m.title); search(m.title); }}
                        className="flex items-center justify-between gap-3 rounded-md border border-border-muted bg-surface/50 px-3.5 py-2.5 text-left hover:border-accent-sharp/30 hover:bg-surface transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground font-medium truncate">{m.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold ${d.cls}`}>{d.emoji} {m.direction}</span>
                            <span className="text-[10px] text-muted tabular-nums">{m.confidenceScore}/100</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-black text-foreground tabular-nums">
                            ${(m.volume24h / 1000).toFixed(0)}k
                          </p>
                          <p className="text-[9px] text-muted">{m.whaleTradeCount} trades</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
