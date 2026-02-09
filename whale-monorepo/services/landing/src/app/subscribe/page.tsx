'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function SubscribeForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [tier, setTier] = useState<'free' | 'pro' | 'elite'>('pro');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = (searchParams.get('plan') || '').toLowerCase();
    if (p === 'free') setTier('free');
    else if (p === 'elite' || p === 'institutional') setTier('elite');
    else setTier('pro');
  }, [searchParams]);

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

    // If FREE, directly activate without checkout
    if (tier === 'free') {
      try {
        const res = await fetch('/api/upgrade', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan: 'FREE' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Activation failed. Please try again.');
          return;
        }
        window.location.href = '/dashboard';
      } catch {
        setError('Network error while activating Free plan. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Construct plan for payment checkout
    const planName = period === 'yearly' ? `${tier}_yearly` : tier;

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegram_activation_code: code, plan: planName })
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
    <form onSubmit={onSubmit} className="glass rounded-2xl border border-white/10 p-6 space-y-6">
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Activation Code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={tier === 'free' ? 'Not required for Free' : 'ABCD1234'}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60 transition-all"
          required={tier !== 'free'}
          disabled={tier === 'free'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as 'free' | 'pro' | 'elite')}
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60 transition-all appearance-none"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Billing</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'monthly' | 'yearly')}
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60 transition-all appearance-none"
            disabled={tier === 'free'}
          >
            <option value="monthly">Monthly {tier === 'pro' ? '($29)' : tier === 'elite' ? '($59)' : ''}</option>
            <option value="yearly">Yearly {tier === 'pro' ? '($290)' : tier === 'elite' ? '($590)' : ''}</option>
          </select>
        </div>
      </div>

      {error ? <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">{error}</div> : null}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full shadow-lg text-lg py-4 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all"
      >
        {loading ? (tier === 'free' ? 'Activating…' : 'Redirecting to checkout…') : (tier === 'free' ? 'Activate Free' : 'Proceed to Checkout')}
      </button>

      <div className="text-sm text-gray-500 text-center">
        <Link href="/" className="hover:text-gray-300 transition-colors">← Back to home</Link>
      </div>
    </form>
  );
}

export default function SubscribePage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-32 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[100px] -z-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] -z-10"></div>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-white tracking-tight">Activate Intelligence</h1>
        <div className="space-y-6 text-gray-400 mb-10 text-lg font-light leading-relaxed">
          <p>
            1. Open <a href="https://t.me/sightwhale_bot" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 font-medium underline decoration-violet-500/30 underline-offset-4">@sightwhale_bot</a> and run <code className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-violet-300">/start</code>
          </p>
          <p>
            2. Tap <span className="text-white font-medium">Generate Code</span> to receive your unique token
          </p>
          <p>
            3. Select your plan below and proceed to secure checkout
          </p>
        </div>

        <Suspense fallback={<div className="glass rounded-2xl border border-white/10 p-12 text-center text-gray-500">Loading checkout options...</div>}>
          <SubscribeForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
