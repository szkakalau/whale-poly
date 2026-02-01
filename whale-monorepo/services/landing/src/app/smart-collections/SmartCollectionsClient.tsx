'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

export type SmartCollectionItem = {
  id: string;
  name: string;
  description: string;
  ruleJson: string;
  enabled: boolean;
  whaleCount: number;
  subscribed: boolean;
};

type Props = {
  initialItems: SmartCollectionItem[];
};

export default function SmartCollectionsClient({ initialItems }: Props) {
  const [items, setItems] = useState<SmartCollectionItem[]>(initialItems);
  const [pending, startTransition] = useTransition();

  function toggleSubscribe(id: string) {
    const current = items.find((c) => c.id === id);
    if (!current) return;
    const nextSubscribed = !current.subscribed;
    setItems((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, subscribed: nextSubscribed } : c,
      ),
    );
    startTransition(async () => {
      const res = await fetch(
        `/api/smart-collections/${encodeURIComponent(id)}/subscribe`,
        {
          method: nextSubscribed ? 'POST' : 'DELETE',
        },
      );
      if (!res.ok) {
        setItems((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, subscribed: current.subscribed } : c,
          ),
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <div className="text-sm text-gray-400">
          No smart collections are available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between"
            >
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    {c.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => toggleSubscribe(c.id)}
                    disabled={pending}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      c.subscribed
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                        : 'border-violet-500/60 bg-violet-500/10 text-violet-200'
                    }`}
                  >
                    {c.subscribed ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
                {c.description && (
                  <p className="text-xs text-gray-400 line-clamp-3">
                    {c.description}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div>Whales: {c.whaleCount}</div>
                <Link
                  href={`/smart-collections/${encodeURIComponent(c.id)}`}
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
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

