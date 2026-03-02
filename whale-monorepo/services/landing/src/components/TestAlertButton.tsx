'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function TestAlertButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const handleClick = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'YES' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setMessage(typeof data?.detail === 'string' ? data.detail : 'Send failed');
        return;
      }
      setStatus('success');
      setMessage('Test alert sent to Telegram');
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again later.');
    }
  };

  const buttonLabel =
    status === 'loading' ? 'Sending…' : status === 'success' ? 'Sent' : 'Send test alert';

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center rounded-full border border-cyan-500/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={status === 'loading'}
      >
        {buttonLabel}
      </button>
      {message ? <div className="text-xs text-gray-400">{message}</div> : null}
    </div>
  );
}
