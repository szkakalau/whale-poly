'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function SubscribePage() {
  const [code, setCode] = useState('');
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mapCheckoutError(detail: unknown, status: number): string {
    const raw = typeof detail === 'string' ? detail : '';
    const code = raw.toLowerCase();
    if (!code) {
      if (status === 429) {
        return 'Too many attempts. Please wait a moment before trying again.';
      }
      return 'Checkout failed. Please try again.';
    }
    if (code.includes('invalid json') || code === 'invalid_json') {
      return 'Something went wrong with the request. Please refresh the page and try again.';
    }
    if (code.includes('telegram_activation_code and plan are required')) {
      return 'Activation code and plan are required. Please fill both fields and submit again.';
    }
    if (code.includes('payment api unreachable') || code.includes('payment api returned non-json')) {
      return 'Payment service is temporarily unavailable. Please try again in a few minutes.';
    }
    if (code.includes('activation') && code.includes('code')) {
      return 'Activation code was not accepted. Double-check the code from the Telegram bot.';
    }
    if (code.includes('payment_api_base_url is required')) {
      return 'Subscription service is not configured yet. Please try again later.';
    }
    return 'Checkout failed. Please try again or contact support if it persists.';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegram_activation_code: code, plan })
      });
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string;
        checkout_url?: string;
      };
      if (!res.ok) {
        setError(mapCheckoutError(data.detail, res.status));
        return;
      }
      const url = String(data.checkout_url || '');
      if (!url) {
        setError('Checkout session could not be created. Please try again.');
        return;
      }
      window.location.href = url;
    } catch {
      setError(
        'Network error while starting checkout. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-32 relative">
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-white">Subscribe</h1>
        <div className="space-y-4 text-gray-300 mb-10">
          <p>
            Step 1: Get an activation code from Telegram bot.
          </p>
          <p>
            Step 2: Paste it here and checkout.
          </p>
          <p className="text-sm text-gray-500">
            Need a code? Open Telegram and run <span className="font-mono">/start</span> then tap Generate Code.
          </p>
        </div>

        <form onSubmit={onSubmit} className="glass rounded-2xl border border-white/10 p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Activation Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value === 'yearly' ? 'yearly' : 'monthly')}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {error ? <div className="text-sm text-red-300">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full shadow-lg text-lg py-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Redirecting…' : 'Checkout'}
          </button>

          <div className="text-sm text-gray-500">
            <Link href="/" className="underline hover:text-gray-300">Back</Link>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
