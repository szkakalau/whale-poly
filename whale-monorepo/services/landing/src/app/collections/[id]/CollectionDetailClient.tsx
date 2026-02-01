'use client';

import { useState, useTransition } from 'react';

type WhaleRow = {
  wallet: string;
};

type Props = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  initialWhales: WhaleRow[];
};

export default function CollectionDetailClient({
  id,
  name,
  description,
  enabled,
  initialWhales,
}: Props) {
  const [currentName, setCurrentName] = useState(name);
  const [currentDescription, setCurrentDescription] = useState(description);
  const [currentEnabled, setCurrentEnabled] = useState(enabled);
  const [whales, setWhales] = useState<WhaleRow[]>(initialWhales);
  const [newWallet, setNewWallet] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveMeta(nextEnabled: boolean | null = null) {
    const payload = {
      name: currentName.trim() || name,
      description: currentDescription.trim(),
      enabled: nextEnabled ?? currentEnabled,
    };
    startTransition(async () => {
      await fetch(`/api/collections/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });
  }

  function toggleEnabled() {
    const next = !currentEnabled;
    setCurrentEnabled(next);
    saveMeta(next);
  }

  function handleAddWhale() {
    const wallet = newWallet.trim();
    if (!wallet) {
      setError('Wallet is required');
      return;
    }
    setError(null);
    const normalized = wallet.toLowerCase();
    if (whales.some((w) => w.wallet === normalized)) {
      setNewWallet('');
      return;
    }
    setWhales((prev) => [{ wallet: normalized }, ...prev]);
    setNewWallet('');
    startTransition(async () => {
      const res = await fetch(`/api/collections/${encodeURIComponent(id)}/whales`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      if (!res.ok) {
        setWhales((prev) => prev.filter((w) => w.wallet !== normalized));
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(data.detail || 'Failed to add whale');
      }
    });
  }

  function handleRemove(wallet: string) {
    const normalized = wallet.toLowerCase();
    setWhales((prev) => prev.filter((w) => w.wallet !== normalized));
    startTransition(async () => {
      const res = await fetch(
        `/api/collections/${encodeURIComponent(id)}/whales/${encodeURIComponent(wallet)}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok) {
        setWhales((prev) =>
          prev.some((w) => w.wallet === normalized)
            ? prev
            : [{ wallet: normalized }, ...prev],
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 space-y-3">
          <input
            type="text"
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
            onBlur={() => saveMeta()}
            className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-lg font-semibold text-white outline-none focus:border-violet-500"
          />
          <textarea
            value={currentDescription}
            onChange={(e) => setCurrentDescription(e.target.value)}
            onBlur={() => saveMeta()}
            placeholder="Description (optional)"
            className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500 min-h-[60px]"
          />
        </div>
        <button
          type="button"
          onClick={toggleEnabled}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
            currentEnabled
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
              : 'border-gray-500/60 bg-gray-800 text-gray-300'
          }`}
          disabled={pending}
        >
          {currentEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <input
            type="text"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            placeholder="Add whale wallet (0x...)"
            className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            type="button"
            onClick={handleAddWhale}
            disabled={pending}
            className={`inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/20 px-4 py-1.5 text-sm font-medium text-violet-50 hover:bg-violet-500/30 ${
              pending ? 'opacity-60 cursor-wait' : ''
            }`}
          >
            Add Whale
          </button>
        </div>
        {error && <div className="text-xs text-rose-300">{error}</div>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Whales</h2>
          <div className="text-xs text-gray-500">Total: {whales.length}</div>
        </div>
        {whales.length === 0 ? (
          <div className="text-sm text-gray-400">No whales in this collection yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-300">
              <thead className="text-xs uppercase tracking-wide text-gray-500 border-b border-white/10">
                <tr>
                  <th className="py-2 pr-4 text-left">Wallet</th>
                  <th className="py-2 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {whales.map((w) => (
                  <tr key={w.wallet} className="hover:bg-white/[0.03]">
                    <td className="py-3 pr-4 align-top font-mono text-xs text-gray-300">
                      {w.wallet}
                    </td>
                    <td className="py-3 pl-4 align-top text-right text-xs">
                      <button
                        type="button"
                        onClick={() => handleRemove(w.wallet)}
                        disabled={pending}
                        className="inline-flex items-center rounded-full border border-rose-500/60 bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-500/20"
                      >
                        Remove
                      </button>
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

