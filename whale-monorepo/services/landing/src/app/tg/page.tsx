'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AuthState =
  | { status: 'idle' | 'loading' }
  | { status: 'authed'; plan: string; planExpireAt: string | null }
  | { status: 'error'; message: string };

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

type TelegramContainer = {
  WebApp?: TelegramWebApp;
};

type AuthResponse = {
  user?: {
    plan?: string;
    planExpireAt?: string | null;
  };
};

function getTelegramWebApp(): TelegramWebApp | null {
  return (globalThis as { Telegram?: TelegramContainer })?.Telegram?.WebApp ?? null;
}

export default function TelegramMiniAppPage() {
  const tg = useMemo(() => getTelegramWebApp(), []);
  const [state, setState] = useState<AuthState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!tg) {
        setState({ status: 'error', message: 'Please open this page inside Telegram.' });
        return;
      }

      try {
        tg.ready?.();
        tg.expand?.();
      } catch {}

      const initData: string = tg.initData || '';
      if (!initData) {
        setState({ status: 'error', message: 'Missing Telegram initData.' });
        return;
      }

      setState({ status: 'loading' });

      const res = await fetch('/api/tg/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ initData }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = (j && (j.detail as string)) || `auth_failed_${res.status}`;
        setState({ status: 'error', message: msg });
        return;
      }

      const data = (await res.json()) as AuthResponse;

      if (cancelled) return;

      setState({
        status: 'authed',
        plan: data?.user?.plan || 'FREE',
        planExpireAt: data?.user?.planExpireAt || null,
      });
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [tg]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-[10px] font-bold tracking-[0.35em] uppercase text-gray-500">Telegram Mini App</div>
          <div className="mt-3 text-2xl font-black text-white tracking-tight">SightWhale</div>
          <div className="mt-2 text-sm text-gray-400">Follow whales. Get verified alerts.</div>

          {state.status === 'loading' || state.status === 'idle' ? (
            <div className="mt-6 text-sm text-gray-400">Connecting…</div>
          ) : null}

          {state.status === 'error' ? (
            <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {state.message}
            </div>
          ) : null}

          {state.status === 'authed' ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Plan</div>
                <div className="mt-1 text-lg font-semibold text-white">{state.plan}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {state.planExpireAt ? `Expires ${new Date(state.planExpireAt).toLocaleString()}` : 'No expiry'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Link
                  href="/follow"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white"
                >
                  Manage Followed Whales
                </Link>
                <Link
                  href="/smart-collections"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white"
                >
                  Smart Collections
                </Link>
                <Link
                  href="/subscribe"
                  className="rounded-2xl border border-violet-500/40 bg-violet-500/15 px-4 py-3 text-center text-sm font-bold text-white"
                >
                  Upgrade Plan
                </Link>
              </div>

              <div className="text-[11px] text-gray-500">
                Win Rate counts settled trades only. New positions may take time to settle.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
