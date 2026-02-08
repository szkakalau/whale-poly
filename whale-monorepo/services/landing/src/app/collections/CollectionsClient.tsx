'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import UpgradeModal from '@/components/UpgradeModal';

export type CollectionItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  whaleCount: number;
};

type Props = {
  initialItems: CollectionItem[];
};

export default function CollectionsClient({ initialItems }: Props) {
  const [items, setItems] = useState<CollectionItem[]>(initialItems);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState({ title: '', description: '', feature: '' });

  function mapCollectionError(detail?: string): string {
    const code = String(detail || '').toLowerCase();
    if (!code || code === 'validation_error') {
      return 'Unable to create collection. Please check the fields and try again.';
    }
    if (code === 'invalid_json' || code === 'invalid_body' || code.includes('invalid json')) {
      return 'Request was malformed. Please refresh the page and try again.';
    }
    if (code === 'name_required') {
      return 'Collection name is required.';
    }
    return 'Failed to create collection. Please try again.';
  }

  function handleCreate() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    const tempId = `tmp_${Date.now()}`;
    const optimistic: CollectionItem = {
      id: tempId,
      name: name.trim(),
      description: description.trim(),
      enabled: true,
      whaleCount: 0,
    };
    setItems((prev) => [optimistic, ...prev]);
    setCreating(false);
    setName('');
    setDescription('');

    startTransition(async () => {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: optimistic.name,
          description: optimistic.description,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
        const detail = data.detail || '';

        if (detail === 'plan_restricted') {
          setUpgradeInfo({
            title: 'Upgrade to Create',
            description: 'Free users cannot create custom collections. Upgrade to Pro to organize your favorite whales.',
            feature: 'Collections'
          });
          setShowUpgrade(true);
          setItems((prev) => prev.filter((c) => c.id !== tempId));
          return;
        }

        if (detail === 'collection_limit_reached') {
          setUpgradeInfo({
            title: 'Limit Reached',
            description: 'You have reached the maximum number of collections for your plan. Upgrade to Elite for higher limits.',
            feature: 'Collection Limit'
          });
          setShowUpgrade(true);
          setItems((prev) => prev.filter((c) => c.id !== tempId));
          return;
        }

        if (data.message) {
          setError(data.message);
        } else {
          setError(mapCollectionError(data.detail));
        }
        setItems((prev) => prev.filter((c) => c.id !== tempId));
        return;
      }
      const json = (await res.json()) as {
        id: string;
        name: string;
        description: string;
        enabled: boolean;
        whale_count?: number;
      };
      setItems((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? {
                id: json.id,
                name: json.name,
                description: json.description,
                enabled: json.enabled,
                whaleCount: json.whale_count ?? 0,
              }
            : c,
        ),
      );
    });
  }

  function toggleEnabled(id: string) {
    const current = items.find((c) => c.id === id);
    if (!current) return;
    const nextEnabled = !current.enabled;
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: nextEnabled } : c)),
    );
    startTransition(async () => {
      const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: current.name,
          description: current.description,
          enabled: nextEnabled,
        }),
      });
      if (!res.ok) {
        setItems((prev) =>
          prev.map((c) => (c.id === id ? { ...c, enabled: current.enabled } : c)),
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Collections</h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/20 px-4 py-1.5 text-sm font-medium text-violet-50 hover:bg-violet-500/30"
        >
          {creating ? 'Cancel' : 'Create Collection'}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Collection name"
              className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending}
              className={`inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-500/20 px-4 py-1.5 text-sm font-medium text-emerald-50 hover:bg-emerald-500/30 ${
                pending ? 'opacity-60 cursor-wait' : ''
              }`}
            >
              Save
            </button>
          </div>
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-3">
              <p className="text-xs text-red-200">{error}</p>
            </div>
          )}
        </div>
      )}

      <UpgradeModal 
        isOpen={showUpgrade} 
        onClose={() => setShowUpgrade(false)}
        title={upgradeInfo.title}
        description={upgradeInfo.description}
        feature={upgradeInfo.feature}
      />

      {items.length === 0 ? (
        <div className="text-sm text-gray-400 space-y-3">
          <p>
            No collections yet. Collections let you group multiple whales into a single theme or
            strategy so you can see their flows together.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20"
            >
              Create your first collection
            </button>
            <Link
              href="/blog"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-100 hover:bg-white/10"
            >
              See ideas for grouping whales
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
                    onClick={() => toggleEnabled(c.id)}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      c.enabled
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                        : 'border-gray-500/60 bg-gray-800 text-gray-300'
                    }`}
                    disabled={pending}
                  >
                    {c.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {c.description && (
                  <p className="text-xs text-gray-400 line-clamp-2">{c.description}</p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div>Whales: {c.whaleCount}</div>
                <Link
                  href={`/collections/${encodeURIComponent(c.id)}`}
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
