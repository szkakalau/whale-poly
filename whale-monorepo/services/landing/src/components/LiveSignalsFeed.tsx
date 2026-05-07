'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LiveSignal } from '@/lib/live-signals';

export type { LiveSignal };

const POLL_MS = 5 * 60 * 1000;
const SOUND_STORAGE_KEY = 'sightwhale_signal_sound_on';

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

function readSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(SOUND_STORAGE_KEY);
  if (v === null) return true;
  return v !== '0';
}

function playSignalBeep() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.07;
    o.start();
    o.stop(ctx.currentTime + 0.1);
    ctx.resume?.().catch(() => {});
  } catch {
    /* ignore */
  }
}

export default function LiveSignalsFeed({
  signals: initialSignals,
  homePreview = false,
}: {
  signals: LiveSignal[];
  homePreview?: boolean;
}) {
  const router = useRouter();
  const [signals, setSignals] = useState<LiveSignal[]>(initialSignals);
  const [refreshing, setRefreshing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [toast, setToast] = useState<{ href: string; label: string } | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const next = homePreview ? initialSignals.slice(0, 3) : initialSignals;
    setSignals(next);
    next.forEach((s) => seenIdsRef.current.add(s.id));
  }, [initialSignals, homePreview]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/plan')
      .then((r) => r.json())
      .then((data: { isPaid?: boolean }) => {
        if (cancelled) return;
        setIsPaid(Boolean(data?.isPaid));
        setPlanLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setPlanLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialSignals.length > 0) return;
    let cancelled = false;
    fetch('/api/live-signals')
      .then((r) => r.json())
      .then((data: { signals?: LiveSignal[] }) => {
        if (cancelled || !Array.isArray(data.signals) || data.signals.length === 0) return;
        const list = homePreview ? data.signals.slice(0, 3) : data.signals;
        setSignals(list);
        list.forEach((s) => seenIdsRef.current.add(s.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialSignals.length, homePreview]);

  useEffect(() => {
    if (homePreview || !planLoaded || !isPaid) return;

    const poll = async () => {
      try {
        const r = await fetch('/api/live-signals', { cache: 'no-store' });
        const data = (await r.json()) as { signals?: LiveSignal[] };
        if (!Array.isArray(data.signals)) return;

        const incoming = data.signals;
        const newOnes = incoming.filter((s) => !seenIdsRef.current.has(s.id));
        if (newOnes.length > 0) {
          newOnes.forEach((s) => seenIdsRef.current.add(s.id));
          const latest = [...newOnes].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
          )[0];
          setToast({
            href: latest.href || '/#live-signals',
            label: latest.market.slice(0, 80) || '新信号',
          });
          if (readSoundEnabled()) {
            playSignalBeep();
          }
        }
        setSignals(homePreview ? incoming.slice(0, 3) : incoming);
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [planLoaded, isPaid, homePreview]);

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
    const cap = homePreview ? 3 : 8;
    const size = Math.min(cap, signals.length);
    return Array.from({ length: size }, (_, i) => signals[(cursor + i) % signals.length]);
  }, [signals, cursor, homePreview]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const r = await fetch('/api/live-signals', { cache: 'no-store' });
      const data = (await r.json()) as { signals?: LiveSignal[] };
      if (Array.isArray(data.signals) && data.signals.length > 0) {
        const list = homePreview ? data.signals.slice(0, 3) : data.signals;
        setSignals(list);
        list.forEach((s) => seenIdsRef.current.add(s.id));
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="relative rounded-xl sm:rounded-[2rem] border border-border bg-surface/80 overflow-hidden">
      {toast ? (
        <div className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
          <div className="flex items-start gap-3 rounded-xl border border-red-500/50 bg-red-950/95 px-4 py-3 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setToast(null);
                router.push(toast.href);
              }}
            >
              <p className="text-xs font-black uppercase tracking-wider text-red-200">新信号发布</p>
              <p className="mt-1 text-sm font-semibold text-white">点击查看 · {toast.label}</p>
            </button>
            <button
              type="button"
              aria-label="关闭"
              className="shrink-0 rounded-lg p-1 text-red-200 hover:bg-white/10"
              onClick={() => setToast(null)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <div className="text-xs font-black tracking-[0.25em] uppercase text-emerald-300">
            Live Signals
          </div>
          {isPaid ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              实时信号
            </span>
          ) : null}
          <div className="text-xs text-subtle hidden sm:block">Anonymized whale activity</div>
        </div>
        <div className="flex items-center gap-3">
          {isPaid ? (
            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-subtle select-none">
              <input
                type="checkbox"
                className="rounded border-border"
                defaultChecked={readSoundEnabled()}
                onChange={(e) => {
                  window.localStorage.setItem(SOUND_STORAGE_KEY, e.target.checked ? '1' : '0');
                }}
              />
              声音提醒
            </label>
          ) : null}
          <Link
            href="/pricing"
            className="text-xs font-semibold text-[#7AA2FF] hover:text-[#5B8CFF] underline underline-offset-4"
          >
            Get full feed
          </Link>
        </div>
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
              {!isPaid && planLoaded ? (
                <>
                  {' '}
                  Free accounts only see signals before today (UTC). Upgrade for full real-time feed.
                </>
              ) : null}
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
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl min-h-[44px] px-4 py-2.5 text-xs font-semibold border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Unlock real-time
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
