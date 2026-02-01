'use client';

import { useState, useTransition } from 'react';

type Props = {
  wallet: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function WhaleFollowSettingsModal({ wallet, onClose, onSaved }: Props) {
  const [alertEntry, setAlertEntry] = useState(true);
  const [alertExit, setAlertExit] = useState(true);
  const [alertAdd, setAlertAdd] = useState(true);
  const [minSize, setMinSize] = useState('0');
  const [minScore, setMinScore] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const body = {
        wallet,
        alert_entry: alertEntry,
        alert_exit: alertExit,
        alert_add: alertAdd,
        min_size: Number(minSize || 0),
        min_score: Number(minScore || 0),
      };
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(data.detail || 'Failed to save follow settings');
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#05020f] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-2">Follow Whale</h2>
        <p className="text-xs text-gray-500 mb-4 font-mono">{wallet}</p>
        <div className="space-y-4 mb-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-300">Alert Types</div>
            <div className="flex flex-col gap-2 text-sm text-gray-200">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-600 bg-transparent"
                  checked={alertEntry}
                  onChange={(e) => setAlertEntry(e.target.checked)}
                />
                <span>Entry</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-600 bg-transparent"
                  checked={alertExit}
                  onChange={(e) => setAlertExit(e.target.checked)}
                />
                <span>Exit</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-600 bg-transparent"
                  checked={alertAdd}
                  onChange={(e) => setAlertAdd(e.target.checked)}
                />
                <span>Add to position</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Size (USD)</label>
              <input
                type="number"
                min={0}
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Whale Score</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>
        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="text-sm text-gray-400 hover:text-gray-200"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/20 px-4 py-1.5 text-sm font-medium text-violet-50 hover:bg-violet-500/30 ${
              pending ? 'opacity-60 cursor-wait' : ''
            }`}
            onClick={handleSave}
            disabled={pending}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

