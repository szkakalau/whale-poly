'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export type LiveSignal = {
  id: string;
  occurredAt: string;
  walletMasked: string;
  market: string;
  side: 'BUY' | 'SELL' | 'UNKNOWN';
  sizeUsd: number;
  whaleScore?: number;
  href?: string;
};

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

export default function LiveSignalsFeed({ signals }: { signals: LiveSignal[] }) {
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

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <div className="text-xs font-black tracking-[0.25em] uppercase text-emerald-300">
            Live Signals
          </div>
          <div className="text-xs text-gray-500 hidden sm:block">Anonymized whale activity</div>
        </div>
        <Link
          href="/smart-money"
          className="text-xs font-semibold text-violet-200 hover:text-violet-100 underline underline-offset-4"
        >
          View Smart Money
        </Link>
      </div>

      <div className="px-3 py-3">
        {windowed.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            No signals available right now.
          </div>
        ) : (
          <div className="space-y-2">
            {windowed.map((s) => {
              const row = (
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.04] transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-black tracking-[0.2em] uppercase ${
                          s.side === 'BUY' ? 'text-emerald-300' : s.side === 'SELL' ? 'text-red-300' : 'text-gray-400'
                        }`}
                      >
                        {s.side}
                      </span>
                      {typeof s.whaleScore === 'number' && Number.isFinite(s.whaleScore) ? (
                        <span className="text-[10px] font-black text-violet-200/80 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
                          Score {s.whaleScore.toFixed(0)}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-gray-500">{formatRelativeTime(s.occurredAt)}</span>
                    </div>
                    <div className="mt-2 text-sm text-white font-semibold truncate">
                      {s.market}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500 font-mono">
                      {s.walletMasked}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-white">{formatUsdCompact(s.sizeUsd)}</div>
                    <div className="text-[10px] text-gray-500 mt-1">trade size</div>
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

