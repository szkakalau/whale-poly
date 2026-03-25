'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LiveSignal } from '@/lib/live-signals';

export type { LiveSignal };

function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function LiveSignalsFeed({ signals: initialSignals }: { signals: LiveSignal[] }) {
  const [signals, setSignals] = useState<LiveSignal[]>(initialSignals);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setSignals(initialSignals);
  }, [initialSignals]);

  useEffect(() => {
    if (initialSignals.length > 0) return;
    let cancelled = false;
    fetch('/api/live-signals')
      .then((r) => r.json())
      .then((data: { signals?: LiveSignal[] }) => {
        if (cancelled || !Array.isArray(data.signals) || data.signals.length === 0) return;
        setSignals(data.signals);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialSignals.length]);

  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (signals.length <= 1) return;
    const timer = setInterval(() => {
      setCursor((c) => (c + 1) % signals.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [signals.length]);

  const windowed = useMemo(() => {
    if (signals.length === 0) return [];
    const size = Math.min(8, signals.length);
    return Array.from({ length: size }, (_, i) => signals[(cursor + i) % signals.length]);
  }, [signals, cursor]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const r = await fetch('/api/live-signals', { cache: 'no-store' });
      const data = (await r.json()) as { signals?: LiveSignal[] };
      if (Array.isArray(data.signals) && data.signals.length > 0) {
        setSignals(data.signals);
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="rounded-xl sm:rounded-[2rem] border border-border bg-surface/80 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <div className="text-xs font-black tracking-[0.25em] uppercase text-emerald-300">
            Live Signals
          </div>
          <div className="text-xs text-subtle hidden sm:block">Anonymized whale activity</div>
        </div>
        <Link
          href="/smart-money"
          className="text-xs font-semibold text-[#7AA2FF] hover:text-[#5B8CFF] underline underline-offset-4"
        >
          View Smart Money
        </Link>
      </div>

      <div className="px-3 sm:px-4 py-3">
        {windowed.length === 0 ? (
          <div className="px-3 py-10 sm:py-12 text-center max-w-md mx-auto">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5B8CFF]/12 border border-[#5B8CFF]/25 mb-4">
              <svg className="w-6 h-6 text-[#7AA2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No live rows to show yet</p>
            <p className="text-xs text-subtle leading-relaxed mb-5">
              We pull recent trades from tracked whales. If the feed is empty, upstream data may be slow or the
              indexer hasn&apos;t updated yet.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="inline-flex items-center justify-center rounded-xl min-h-[44px] px-4 py-2.5 text-xs font-semibold bg-[#5B8CFF] text-white hover:bg-[#7AA2FF] active:bg-[#3D6FE0] disabled:opacity-60 transition-colors"
              >
                {refreshing ? 'Refreshing…' : 'Refresh feed'}
              </button>
              <Link
                href="/smart-money"
                className="inline-flex items-center justify-center rounded-xl min-h-[44px] px-4 py-2.5 text-xs font-semibold border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Browse leaderboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {windowed.map((s) => {
              const row = (
                <div className="rounded-2xl border border-border bg-background/60 px-4 py-3 flex items-center justify-between gap-4 hover:bg-surface-hover transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-black tracking-[0.2em] uppercase ${
                          s.side === 'BUY' ? 'text-emerald-300' : s.side === 'SELL' ? 'text-red-300' : 'text-muted'
                        }`}
                      >
                        {s.side}
                      </span>
                      {typeof s.whaleScore === 'number' && Number.isFinite(s.whaleScore) ? (
                        <span className="text-[10px] font-black text-[#7AA2FF]/90 bg-[#5B8CFF]/12 border border-[#5B8CFF]/25 rounded-full px-2 py-0.5">
                          Score {s.whaleScore.toFixed(0)}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-subtle">{formatRelativeTime(s.occurredAt)}</span>
                    </div>
                    <div className="mt-2 text-sm text-foreground font-semibold truncate">{s.market}</div>
                    <div className="mt-1 text-[11px] text-subtle font-mono">{s.walletMasked}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-foreground">{formatUsdCompact(s.sizeUsd)}</div>
                    <div className="text-[10px] text-subtle mt-1">trade size</div>
                  </div>
                </div>
              );

              return (
                <div key={s.id}>
                  {s.href ? (
                    <Link href={s.href} className="block">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
