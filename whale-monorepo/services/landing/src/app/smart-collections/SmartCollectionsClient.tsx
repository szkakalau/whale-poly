'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

export type SmartCollectionItem = {
  id: string;
  name: string;
  description: string;
  subscribed: boolean;
};

type Props = {
  initialItems: SmartCollectionItem[];
  canManage: boolean;
};

export default function SmartCollectionsClient({ initialItems, canManage }: Props) {
  const [items, setItems] = useState<SmartCollectionItem[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mapSubscribeError(detail?: string): string {
    const code = String(detail || '').toLowerCase();
    if (!code || code === 'validation_error') {
      return 'Unable to update subscription. Please try again.';
    }
    if (code === 'subscription_limit_reached') {
      return 'You have reached the maximum number of smart collections for your plan.';
    }
    if (code === 'not_found') {
      return 'This smart collection is no longer available.';
    }
    return 'Failed to update smart collection subscription. Please try again.';
  }

  function toggleSubscription(id: string) {
    if (!canManage) {
      setError('Connect your Telegram and activate a plan before subscribing.');
      return;
    }
    setError(null);
    const current = items.find((c) => c.id === id);
    if (!current) return;
    const nextSubscribed = !current.subscribed;
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, subscribed: nextSubscribed } : c)),
    );
    startTransition(async () => {
      const res = await fetch(
        `/api/smart-collections/${encodeURIComponent(id)}/subscribe`,
        {
          method: nextSubscribed ? 'POST' : 'DELETE',
          headers: { 'content-type': 'application/json' },
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(mapSubscribeError(data.detail));
        setItems((prev) =>
          prev.map((c) => (c.id === id ? { ...c, subscribed: current.subscribed } : c)),
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-sm text-gray-400 space-y-3">
          <p>
            No smart collections are visible yet. Once available, you&apos;ll see curated groups
            of whales (by strategy, behavior, or market focus) here.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
            >
              Back to landing
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-100 hover:bg-white/10"
            >
              Read how we group smart money
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between"
            >
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                  <button
                    type="button"
                    onClick={() => toggleSubscription(c.id)}
                    disabled={pending}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      c.subscribed
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                        : 'border-gray-500/60 bg-gray-800 text-gray-300'
                    } ${pending ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {c.subscribed ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
                {c.description && (
                  <p className="text-xs text-gray-400 line-clamp-2">{c.description}</p>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>Smart grouping of whales by on-chain behavior</span>
                <Link
                  href={`/smart-collections/${encodeURIComponent(c.id)}`}
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

