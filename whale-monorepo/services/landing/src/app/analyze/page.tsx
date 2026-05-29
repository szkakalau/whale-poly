'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, ArrowRight, TrendingUp, Wallet, ShieldAlert, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';

type WalletEvidence = {
  addressShort: string;
  action: string;
  amountUsd: number;
  outcome: string;
  walletWeight: number;
};

type Candidate = {
  slug: string;
  title: string;
  volume24h?: number;
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
};

export default function AnalyzePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/analyze?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.candidates?.length > 0) {
          // Show candidates as partial result
          setResult({ ...data, direction: 'neutral', confidenceLevel: 'low', confidenceScore: 0, whaleTradeCount: 0, topWallets: [], yesVolumeUsd: 0, noVolumeUsd: 0 });
          setError(data.message || 'No match found.');
        } else {
          setError(data.message || '分析失败。');
        }
        return;
      }

      setResult(data);
    } catch {
      setError('⚠️ 网络错误，请稍后再试。');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const dirConfig = {
    bullish: { emoji: '🟢', label: 'Bullish', color: 'text-emerald-400' },
    bearish: { emoji: '🔴', label: 'Bearish', color: 'text-red-400' },
    neutral: { emoji: '⚪', label: 'Neutral', color: 'text-muted' },
    mixed: { emoji: '🟡', label: 'Mixed', color: 'text-amber-400' },
  };

  return (
    <main className="min-h-screen px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Whale Decision Engine
          </h1>
          <p className="mt-3 text-sm text-muted max-w-md mx-auto leading-relaxed">
            输入 Polymarket 市场链接或关键词，获取鲸鱼交易方向 + 信心分 + 证据链。
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入市场链接或关键词… 例如 BTC 150k"
                className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-sharp/30 focus:border-accent-sharp transition-all"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-sharp px-5 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  分析
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-2xl border border-border bg-surface/50 p-6 sm:p-8 animate-pulse space-y-4">
            <div className="h-6 w-48 bg-surface-hover rounded" />
            <div className="h-4 w-32 bg-surface-hover rounded" />
            <div className="h-4 w-full bg-surface-hover rounded" />
            <div className="h-4 w-3/4 bg-surface-hover rounded" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 sm:p-8 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-300 font-semibold mb-1">未能识别该市场</p>
                <p className="text-sm text-muted">{error}</p>
              </div>
            </div>
            {/* Candidates */}
            {result?.candidates && result.candidates.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wider">你是指这些市场吗？</p>
                <div className="space-y-2">
                  {result.candidates.slice(0, 3).map((c) => (
                    <button
                      key={c.slug}
                      onClick={() => { setQuery(c.title); search(c.title); }}
                      className="block w-full text-left text-sm text-foreground hover:bg-surface-hover rounded-lg px-3 py-2 transition-colors"
                    >
                      {c.title}
                      {c.volume24h ? (
                        <span className="text-xs text-muted ml-2">
                          ${(c.volume24h / 1000).toFixed(0)}k vol
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {result && result.whaleTradeCount > 0 && (
          <div className="rounded-2xl border border-border bg-surface/50 p-6 sm:p-8 space-y-6">
            {/* Direction header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">
                  {result.matchMethod === 'url' ? 'URL 匹配' : 'Gamma API 搜索'}
                </p>
                <h2 className="font-display text-xl font-black text-foreground">
                  {result.marketTitle || result.marketSlug}
                </h2>
              </div>
              <a
                href={`https://polymarket.com/event/${result.marketSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted hover:text-foreground transition-colors inline-flex items-center gap-1 shrink-0"
              >
                Polymarket
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Direction + confidence */}
            <div className="flex flex-wrap items-center gap-4">
              <div className={`flex items-center gap-2 rounded-xl border border-border px-4 py-3 ${dirConfig[result.direction].color}`}>
                <span className="text-2xl">{dirConfig[result.direction].emoji}</span>
                <div>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wider">Direction</p>
                  <p className="text-lg font-black">{dirConfig[result.direction].label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-3">
                <TrendingUp className="w-5 h-5 text-accent-sharp" />
                <div>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wider">Confidence</p>
                  <p className="text-lg font-black text-foreground">
                    {result.confidenceScore}
                    <span className="text-sm font-normal text-muted">/100</span>
                    <span className="ml-2 text-xs font-semibold uppercase text-muted">({result.confidenceLevel})</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Volume summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center">
                <p className="text-xs text-muted mb-0.5">YES Volume</p>
                <p className="text-sm font-black text-emerald-400">${(result.yesVolumeUsd / 1000).toFixed(0)}k</p>
              </div>
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center">
                <p className="text-xs text-muted mb-0.5">NO Volume</p>
                <p className="text-sm font-black text-red-400">${(result.noVolumeUsd / 1000).toFixed(0)}k</p>
              </div>
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center">
                <p className="text-xs text-muted mb-0.5">Whale Trades</p>
                <p className="text-sm font-black text-foreground">{result.whaleTradeCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center">
                <p className="text-xs text-muted mb-0.5">Data Age</p>
                <p className="text-sm font-black text-foreground">
                  {result.dataFreshness.stalenessMinutes < 60
                    ? `${result.dataFreshness.stalenessMinutes}m`
                    : `${Math.floor(result.dataFreshness.stalenessMinutes / 60)}h`}
                </p>
              </div>
            </div>

            {/* Wallet evidence */}
            {result.topWallets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-accent-sharp" />
                  <p className="text-sm font-bold text-foreground">关键钱包动向</p>
                </div>
                <div className="space-y-1.5">
                  {result.topWallets.map((w, i) => (
                    <div
                      key={`${w.addressShort}-${i}`}
                      className="flex items-center justify-between rounded-lg border border-border-muted bg-surface px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-foreground">{w.addressShort}</span>
                        <span className={`text-xs font-bold ${w.outcome === 'YES' ? 'text-emerald-400' : w.outcome === 'NO' ? 'text-red-400' : 'text-muted'}`}>
                          {w.action === 'BUY' ? '买入' : w.action === 'SELL' ? '卖出' : '交易'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>${(w.amountUsd / 1000).toFixed(0)}k {w.outcome}</span>
                        <span className="font-mono">w{w.walletWeight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.whaleTradeCount < 3 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">
                  数据有限——仅检测到 {result.whaleTradeCount} 笔鲸鱼交易。需要更多数据点才能做出可靠的方向判断。
                </p>
              </div>
            )}
            {result.dataFreshness.stalenessMinutes > 360 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">
                  数据最后更新于 {Math.floor(result.dataFreshness.stalenessMinutes / 60)} 小时前，可能无法反映最新市场动态。
                </p>
              </div>
            )}
            {result.direction === 'mixed' && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">鲸鱼意见分歧——市场信号不统一，建议谨慎操作。</p>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[11px] text-muted/60 text-center pt-4 border-t border-border-muted">
              {result.disclaimer || 'ⓘ 这不是财务建议。信号基于历史数据，不保证未来结果。交易风险自负。'}
            </p>
          </div>
        )}

        {/* Empty: no whale trades */}
        {result && result.whaleTradeCount === 0 && !error && (
          <div className="rounded-2xl border border-border bg-surface/50 p-6 sm:p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-muted" />
            </div>
            <p className="text-sm text-muted font-semibold mb-1">未检测到鲸鱼活动</p>
            <p className="text-xs text-muted/70">
              该市场在过去 24 小时内没有检测到大额鲸鱼交易（≥ $5k）。
              这可能意味着聪明钱尚未表态。
            </p>
          </div>
        )}

        {/* Initial empty state */}
        {!result && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-5">
              <TrendingUp className="w-7 h-7 text-muted/40" />
            </div>
            <p className="text-sm text-muted font-semibold mb-1">输入市场开始分析</p>
            <p className="text-xs text-muted/60 max-w-xs mx-auto leading-relaxed">
              粘贴一个 Polymarket 链接，或输入市场关键词。系统将分析鲸鱼交易数据，给出方向 + 信心分。
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
