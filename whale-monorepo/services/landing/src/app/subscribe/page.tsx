'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';
const UPSELL_STORAGE_KEY = 'sw_checkout_10off';
const UPSELL_WINDOW_MS = 10 * 60 * 1000;

function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type UpsellState = {
  claimedAt: number | null;
  dismissedAt: number | null;
};

function readUpsellState(): UpsellState {
  try {
    const raw = window.localStorage.getItem(UPSELL_STORAGE_KEY);
    if (!raw) return { claimedAt: null, dismissedAt: null };
    const obj = JSON.parse(raw) as Partial<UpsellState>;
    return {
      claimedAt: typeof obj.claimedAt === 'number' ? obj.claimedAt : null,
      dismissedAt: typeof obj.dismissedAt === 'number' ? obj.dismissedAt : null,
    };
  } catch {
    return { claimedAt: null, dismissedAt: null };
  }
}

function writeUpsellState(next: UpsellState) {
  try {
    window.localStorage.setItem(UPSELL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function isUpsellActive(claimedAt: number | null): boolean {
  if (!claimedAt) return false;
  return Date.now() - claimedAt < UPSELL_WINDOW_MS;
}

function CheckoutUpsellModal({
  open,
  onClose,
  onClaim,
  countdownLabel,
}: {
  open: boolean;
  onClose: () => void;
  onClaim: () => void;
  countdownLabel: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b0d] shadow-[0_30px_120px_-40px_rgba(0,0,0,0.85)] overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-300/15 blur-[70px]" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-violet-500/10 blur-[80px]" />
        <div className="p-5 sm:p-7">
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/80 font-mono">Checkout offer</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white">10% Off Your First Month</h2>
          <p className="mt-3 text-sm sm:text-base text-gray-300 leading-relaxed">
            Only for the next <span className="font-mono font-semibold text-amber-200">{countdownLabel}</span>. Claim it
            now — we’ll apply the discount automatically at checkout.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClaim}
              className="inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-amber-300 px-6 py-3.5 text-sm font-extrabold text-zinc-950 hover:bg-amber-200 transition-colors active:scale-[0.98]"
            >
              Claim 10% Off (10 min)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3.5 text-sm font-semibold text-white hover:border-white/25 hover:bg-white/[0.08] transition-colors active:scale-[0.98]"
            >
              Continue without discount
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 leading-relaxed">Applies to web checkout only.</p>
        </div>
      </div>
    </div>
  );
}

function SubscribeForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [tier, setTier] = useState<'free' | 'pro' | 'elite'>('pro');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; actions: string[] } | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [countdown, setCountdown] = useState('10:00');

  useEffect(() => {
    const p = (searchParams.get('plan') || '').toLowerCase();
    const codeFromUrl = (searchParams.get('code') || '').trim();
    const periodFromUrl = (searchParams.get('period') || '').toLowerCase();
    if (p === 'free') setTier('free');
    else if (p === 'elite' || p === 'institutional') setTier('elite');
    else setTier('pro');
    if (periodFromUrl === 'yearly' || periodFromUrl === 'annual') {
      setPeriod('yearly');
    } else if (periodFromUrl === 'monthly') {
      setPeriod('monthly');
    }
    if (codeFromUrl && !code) {
      // Auto-fill activation code from deep link (e.g. Telegram -> /subscribe?code=...)
      setCode(codeFromUrl.toUpperCase());
    }
  }, [searchParams, code]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const state = readUpsellState();
      if (!state.claimedAt) {
        setCountdown('10:00');
        return;
      }
      const msLeft = UPSELL_WINDOW_MS - (Date.now() - state.claimedAt);
      setCountdown(formatCountdown(msLeft));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function maybeOpenUpsell() {
      const state = readUpsellState();
      if (state.dismissedAt || isUpsellActive(state.claimedAt)) return;
      setUpsellOpen(true);
    }

    function onMouseLeave(e: MouseEvent) {
      if (e.clientY > 0) return;
      maybeOpenUpsell();
    }

    function onPopState() {
      const state = readUpsellState();
      if (state.dismissedAt || isUpsellActive(state.claimedAt)) return;
      setUpsellOpen(true);
      try {
        window.history.pushState({ sw_upsell: true }, '', window.location.href);
      } catch {
        // ignore
      }
    }

    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('popstate', onPopState);
    try {
      window.history.pushState({ sw_upsell: true }, '', window.location.href);
    } catch {
      // ignore
    }
    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  function mapCheckoutError(detail: unknown, status: number): { message: string; actions: string[] } {
    const raw = typeof detail === 'string' ? detail : '';
    const code = raw.toLowerCase();
    if (!code) {
      if (status === 429) {
        return {
          message: 'Too many attempts. Please wait a moment before trying again.',
          actions: ['Wait 60 seconds and resubmit.', 'Keep the same activation code from Telegram.']
        };
      }
      return {
        message: 'Checkout failed. Please try again.',
        actions: ['Confirm your Telegram activation code is valid.', 'Retry in a moment.']
      };
    }
    if (code.includes('invalid json') || code === 'invalid_json') {
      return {
        message: 'Something went wrong with the request.',
        actions: ['Refresh the page and retry.', 'Make sure your activation code is complete.']
      };
    }
    if (code.includes('telegram_activation_code and plan are required')) {
      return {
        message: 'Activation code and plan are required.',
        actions: ['Enter your Telegram activation code.', 'Select a plan and billing period.']
      };
    }
    if (code.includes('payment api unreachable') || code.includes('payment api returned non-json')) {
      return {
        message: 'Payment service is temporarily unavailable.',
        actions: ['Wait a few minutes and try again.', 'If this repeats, contact support.']
      };
    }
    if (code.includes('activation') && code.includes('code')) {
      return {
        message: 'Activation code was not accepted.',
        actions: ['Open @sightwhale_bot and generate a new code.', 'Paste the full code and retry.']
      };
    }
    if (code.includes('invalid plan')) {
      return {
        message: 'Selected plan is not available right now.',
        actions: ['Switch to Pro or Elite and retry.', 'If this looks wrong, contact support.']
      };
    }
    if (code.includes('payment_api_base_url is required')) {
      return {
        message: 'Subscription service is not configured yet.',
        actions: ['Try again later.', 'Contact support if you need immediate access.']
      };
    }
    return {
      message: 'Checkout failed.',
      actions: ['Retry in a minute.', 'Contact support if the issue persists.']
    };
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
          setError({
            message: typeof data.error === 'string' ? data.error : 'Activation failed.',
            actions: ['Retry in a moment.', 'Contact support if this keeps happening.']
          });
          return;
        }
        window.location.href = '/follow';
      } catch {
        setError({
          message: 'Network error while activating Free plan.',
          actions: ['Check your connection and retry.', 'Contact support if the issue persists.']
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Construct plan for payment checkout
    const planName = period === 'yearly' ? `${tier}_yearly` : tier;
    const upsellState = readUpsellState();
    // Note: after the early return above, tier is narrowed to 'pro' | 'elite'.
    const applyPromo = period === 'monthly' && isUpsellActive(upsellState.claimedAt);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegram_activation_code: code, plan: planName, apply_promo: applyPromo })
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
        setError({
          message: 'Checkout session could not be created.',
          actions: ['Retry in a moment.', 'Contact support if the issue persists.']
        });
        return;
      }
      window.location.href = url;
    } catch {
      setError({
        message: 'Network error while starting checkout.',
        actions: ['Check your connection and retry.', 'Contact support if the issue persists.']
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <CheckoutUpsellModal
        open={upsellOpen}
        countdownLabel={countdown}
        onClose={() => {
          const next = { ...readUpsellState(), dismissedAt: Date.now() };
          writeUpsellState(next);
          setUpsellOpen(false);
        }}
        onClaim={() => {
          const next = { claimedAt: Date.now(), dismissedAt: null };
          writeUpsellState(next);
          setUpsellOpen(false);
        }}
      />
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
              <option value="pro">Pro ($29)</option>
              <option value="elite">Elite ($59)</option>
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

        {error ? (
          <div className="text-sm text-red-200 bg-red-500/10 border border-red-500/20 p-4 rounded-lg space-y-2">
            <div className="font-semibold">{error.message}</div>
            <ul className="list-disc list-inside space-y-1 text-red-300">
              {error.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            <Link href="/contact" className="text-red-200 underline underline-offset-4">
              Contact support
            </Link>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full shadow-lg text-lg py-4 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all"
        >
          {loading
            ? tier === 'free'
              ? 'Activating…'
              : 'Redirecting to checkout…'
            : tier === 'free'
              ? 'Activate Free'
              : 'Proceed to Checkout'}
        </button>

        <div className="rounded-xl border border-amber-200/15 bg-amber-200/10 p-4 text-sm text-amber-100/90">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-white">10% Off window</div>
            <div className="font-mono text-xs text-amber-200/90">{countdown}</div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
            If you claim the offer, we’ll apply 10% off your first month automatically for 10 minutes.
          </p>
        </div>

        <div className="text-sm text-gray-500 text-center">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            ← Back to home
          </Link>
        </div>
      </form>
    </>
  );
}

export default function SubscribePage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-24 sm:py-32 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[100px] -z-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] -z-10"></div>
        
        <h1 className="text-[34px] sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 text-white tracking-tight text-balance">
          Activate Intelligence
        </h1>
        <div className="space-y-4 sm:space-y-6 text-gray-400 mb-8 sm:mb-10 text-[15px] sm:text-lg font-light leading-relaxed">
          <p>
            1. Open{' '}
            <a
              href={`${TELEGRAM_BOT_URL}?start=subscribe_pro`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 font-medium underline decoration-violet-500/30 underline-offset-4"
            >
              @sightwhale_bot
            </a>{' '}
            and run <code className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-violet-300">/start</code>
          </p>
          <p>
            2. Tap <span className="text-white font-medium">Generate Code</span> or use the deep link from Telegram. We
            will auto-fill the code here when you return.
          </p>
          <p>
            3. Select your plan below and proceed to secure checkout
          </p>
        </div>

        <Suspense fallback={<div className="glass rounded-2xl border border-white/10 p-12 text-center text-gray-500">Loading checkout options...</div>}>
          <SubscribeForm />
        </Suspense>

        <section className="mt-10 sm:mt-12 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Plan differences you can verify</h2>
            <p className="text-xs text-gray-400 mt-2">
              Limits are enforced in-product and visible in your dashboard after activation.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Free</div>
              <div className="text-lg font-semibold text-white mt-2">$0</div>
              <ul className="mt-3 space-y-2 text-xs text-gray-400">
                <li>3 alerts per day</li>
                <li>10-minute alert delay</li>
                <li>No whale follows</li>
                <li>No smart collections</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
              <div className="text-xs uppercase tracking-wide text-violet-200">Pro</div>
              <div className="text-lg font-semibold text-white mt-2">$29/mo · $290/yr</div>
              <ul className="mt-3 space-y-2 text-xs text-gray-300">
                <li>Unlimited alerts</li>
                <li>Zero alert delay</li>
                <li>Follow up to 20 whales</li>
                <li>Subscribe to 5 smart collections</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="text-xs uppercase tracking-wide text-cyan-200">Elite</div>
              <div className="text-lg font-semibold text-white mt-2">$59/mo · $590/yr</div>
              <ul className="mt-3 space-y-2 text-xs text-gray-200">
                <li>Everything in Pro</li>
                <li>Follow up to 100 whales</li>
                <li>Subscribe to 20 smart collections</li>
                <li>Priority updates</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
