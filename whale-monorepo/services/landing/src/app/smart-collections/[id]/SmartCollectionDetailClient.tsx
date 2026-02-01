'use client';

import { useState, useTransition } from 'react';

type WhaleRow = {
  wallet: string;
  snapshotDate: string;
};

type Props = {
  id: string;
  name: string;
  description: string;
  ruleJson: string;
  enabled: boolean;
  initialSubscribed: boolean;
  whales: WhaleRow[];
};

export default function SmartCollectionDetailClient({
  id,
  name,
  description,
  ruleJson,
  enabled,
  initialSubscribed,
  whales,
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, startTransition] = useTransition();

  function toggleSubscribe() {
    const next = !subscribed;
    setSubscribed(next);
    startTransition(async () => {
      const res = await fetch(
        `/api/smart-collections/${encodeURIComponent(id)}/subscribe`,
        {
          method: next ? 'POST' : 'DELETE',
        },
      );
      if (!res.ok) {
        setSubscribed(!next);
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{name}</h1>
          {description && (
            <p className="text-sm text-gray-400 max-w-2xl">{description}</p>
          )}
          {!enabled && (
            <p className="text-xs text-amber-300">
              This smart collection is currently disabled.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSubscribe}
          disabled={pending || !enabled}
          className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wide ${
            subscribed
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
              : 'border-violet-500/60 bg-violet-500/10 text-violet-200'
          } ${!enabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Rule explanation
          </h2>
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            JSON rule
          </span>
        </div>
        <pre className="text-xs bg-black/50 rounded-xl p-3 text-gray-200 overflow-x-auto">
          {ruleJson}
        </pre>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Whales</h2>
          <div className="text-xs text-gray-500">Total: {whales.length}</div>
        </div>
        {whales.length === 0 ? (
          <div className="text-sm text-gray-400">
            No whales currently match this smart collection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-300">
              <thead className="text-xs uppercase tracking-wide text-gray-500 border-b border-white/10">
                <tr>
                  <th className="py-2 pr-4 text-left">Wallet</th>
                  <th className="py-2 pl-4 text-left">Snapshot date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {whales.map((w) => (
                  <tr key={`${w.wallet}-${w.snapshotDate}`} className="hover:bg-white/[0.03]">
                    <td className="py-3 pr-4 align-top font-mono text-xs text-gray-300">
                      {w.wallet}
                    </td>
                    <td className="py-3 pl-4 align-top text-xs text-gray-400">
                      {new Date(w.snapshotDate).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

