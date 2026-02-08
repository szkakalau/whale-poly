'use client';

import { useState, useTransition } from 'react';
import UpgradeModal from './UpgradeModal';

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
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState({ title: '', description: '', feature: '' });
  const [pending, startTransition] = useTransition();

  function mapError(detail?: string): string {
    const code = String(detail || '').toLowerCase();
    if (code === 'plan_restricted') {
      return 'Free 计划无法关注鲸鱼，请升级 Pro 或 Elite 计划。';
    }
    if (code === 'follow_limit_reached') {
      return '已达到计划的关注上限，请升级更高计划解锁更多。';
    }
    if (!code || code === 'validation_error') {
      return 'Unable to save settings. Please double-check the fields and try again.';
    }
    if (code === 'invalid_body' || code === 'invalid json' || code === 'invalid_json') {
      return 'Request was malformed. Please close and reopen this dialog, then try again.';
    }
    if (code === 'wallet_required') {
      return 'Wallet address is required to follow a whale.';
    }
    if (code === 'min_size_invalid') {
      return 'Min Size must be a non-negative number.';
    }
    if (code === 'min_score_invalid') {
      return 'Min Whale Score must be a non-negative number.';
    }
    if (code === 'at_least_one_action') {
      return 'Select at least one alert type (Entry, Exit, or Add).';
    }
    return 'Failed to save follow settings. Please try again.';
  }

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
        const data = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
        const detail = data.detail || '';
        
        if (detail === 'plan_restricted') {
          setUpgradeInfo({
            title: 'Upgrade to Follow',
            description: 'Free users cannot follow individual whales. Upgrade to Pro to track up to 20 whales with custom alerts.',
            feature: 'Whale Follow'
          });
          setShowUpgrade(true);
          return;
        }
        
        if (detail === 'follow_limit_reached') {
          setUpgradeInfo({
            title: 'Limit Reached',
            description: 'You have reached the maximum number of follows for your plan. Upgrade to Elite for up to 100 whale follows.',
            feature: 'Whale Follow Limit'
          });
          setShowUpgrade(true);
          return;
        }

        if (data.message) {
          setError(data.message);
        } else {
          setError(mapError(detail));
        }
        return;
      }
      onSaved();
    });
  }

  return (
    <>
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
                <div className="text-[10px] text-gray-500 mb-1">
                  Only alert when this whale&apos;s trade size is at least this amount.
                </div>
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
                <div className="text-[10px] text-gray-500 mb-1">
                  Only alert when the whale score is at or above this value (0–100).
                </div>
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
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/50 p-3">
              <p className="text-xs text-red-200">{error}</p>
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

      <UpgradeModal 
        isOpen={showUpgrade} 
        onClose={() => setShowUpgrade(false)}
        title={upgradeInfo.title}
        description={upgradeInfo.description}
        feature={upgradeInfo.feature}
      />
    </>
  );
}
