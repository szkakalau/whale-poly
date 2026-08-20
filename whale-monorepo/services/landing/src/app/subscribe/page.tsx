'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/lib/use-auth';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';
const SUBSCRIBE_START_PARAM = 'subscribe_pro';

type Plan = 'pro' | 'elite';
type Period = 'monthly' | 'yearly';

const PLANS: Record<Plan, { label: string; monthly: number; yearly: number; features: string[] }> = {
  pro: {
    label: 'Pro',
    monthly: 29,
    yearly: 290,
    features: ['Real-time signals in-app', 'Whale Score 70+', 'Optional Telegram (~30s)', 'Follow 20 whales · 5 collections'],
  },
  elite: {
    label: 'Elite',
    monthly: 59,
    yearly: 590,
    features: ['Everything in Pro', 'Whale Score 80+', 'Optional Telegram (~10s)', 'Follow 100 whales · 20 collections'],
  },
};

function getAmount(plan: Plan, period: Period) {
  return period === 'yearly' ? PLANS[plan].yearly : PLANS[plan].monthly;
}

function planFromParam(raw: string | null): Plan {
  const p = (raw || '').toLowerCase();
  return p === 'elite' || p === 'institutional' ? 'elite' : 'pro';
}

function useSubscribeParams() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');

  // Derive plan/period directly from the URL (no state, no effect).
  const plan = planFromParam(searchParams.get('plan'));
  const periodParam = (searchParams.get('period') || '').toLowerCase();
  const period: Period =
    periodParam === 'yearly' || periodParam === 'annual' ? 'yearly' : 'monthly';

  // Render-phase state adjustment (React's documented pattern for syncing
  // state from props/URL params) — pre-fills the code from ?code= deep links.
  const codeParam = (searchParams.get('code') || '').trim();
  if (codeParam && !code) setCode(codeParam.toUpperCase());

  return { plan, period, code, setCode };
}

function SubscribeHero() {
  const searchParams = useSearchParams();
  const plan = planFromParam(searchParams.get('plan'));
  const label = PLANS[plan].label;

  return (
    <>
      <p className="eyebrow mb-4">Subscribe</p>
      <h1 className="text-balance mb-3">Start {label}</h1>
      <p className="text-base text-muted leading-relaxed mb-8">
        Secure checkout with Stripe. Signed-in users can pay right away — no activation code needed. New to Telegram? Grab a code from the bot and paste it below.
      </p>
    </>
  );
}

function SubscribeForm() {
  const checkoutBtnRef = useRef<HTMLButtonElement>(null);

  const { plan, period, code, setCode } = useSubscribeParams();
  const { user: authUser, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; actions: string[] } | null>(null);

  // Logged-in users (Telegram Mini App session) don't need the activation
  // code — the server mints one bound to their telegram id.
  const isLoggedIn = Boolean(authUser);
  const sanitized = code.replace(/\s+/g, '').toUpperCase();
  const hasCode = sanitized.length >= 6;
  const amount = getAmount(plan, period);
  const planLabel = PLANS[plan].label;

  useEffect(() => {
    trackEvent('subscribe_view', { page: 'subscribe' });
  }, []);

  useEffect(() => {
    if (hasCode) trackEvent('activation_code_detected', { page: 'subscribe' });
    if (isLoggedIn && !hasCode) trackEvent('checkout_skip_code_logged_in', { page: 'subscribe' });
  }, [hasCode, isLoggedIn]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Never silently block checkout: give anonymous users without a code a
    // clear, actionable message instead of a dead disabled button.
    if (authLoading) {
      setError({ message: 'Checking sign-in status…', actions: ['Wait a moment and click again.'] });
      return;
    }
    if (!hasCode && !isLoggedIn) {
      trackEvent('checkout_error', { page: 'subscribe', stage: 'validation', plan, period });
      setError({
        message: 'Add your activation code to continue.',
        actions: [
          'Open @sightwhale_bot on Telegram and tap Generate Code.',
          'Paste the code above and click Start Secure Checkout again.',
        ],
      });
      return;
    }

    setLoading(true);

    const planName = period === 'yearly' ? `${plan}_yearly` : plan;
    trackEvent('checkout_start', { page: 'subscribe', plan, period, amount, logged_in: isLoggedIn });

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegram_activation_code: sanitized, plan: planName }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        trackEvent('checkout_error', { page: 'subscribe', stage: 'api', status: res.status, plan, period });
        const msg = typeof data.detail === 'string' ? data.detail : '';
        const lower = msg.toLowerCase();

        if (lower.includes('activation') && lower.includes('code')) {
          setError({ message: 'Activation code was not accepted.', actions: ['Open @sightwhale_bot and generate a new code.', 'Paste the full code and retry.'] });
        } else if (lower.includes('payment api')) {
          setError({ message: 'Payment service is temporarily unavailable.', actions: ['Wait a moment and try again.', 'Contact support if this persists.'] });
        } else if (res.status === 429) {
          setError({ message: 'Too many attempts. Please wait before trying again.', actions: ['Wait 60 seconds.', 'Use the same activation code.'] });
        } else {
          setError({ message: msg || 'Checkout failed. Please try again.', actions: ['Confirm your activation code is valid.', 'Retry in a moment.'] });
        }
        return;
      }

      const url = String(data.checkout_url || '');
      if (!url) {
        setError({ message: 'Checkout session could not be created.', actions: ['Retry in a moment.', 'Contact support if this persists.'] });
        return;
      }

      window.location.href = url;
    } catch {
      trackEvent('checkout_error', { page: 'subscribe', stage: 'network', plan, period });
      setError({ message: 'Network error while starting checkout.', actions: ['Check your connection and retry.', 'Contact support if the issue persists.'] });
    } finally {
      setLoading(false);
    }
  }

  const botHref = `${TELEGRAM_BOT_URL}?start=${SUBSCRIBE_START_PARAM}`;

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-surface p-6 sm:p-8 space-y-6">
      {/* ── Signed-in banner (no activation code needed) ── */}
      {isLoggedIn ? (
        <div className="rounded-lg border border-accent/25 bg-accent/5 px-5 py-4">
          <p className="text-sm text-foreground font-medium">You&apos;re signed in — no activation code needed.</p>
          <p className="text-xs text-muted mt-1">
            Checkout will link this subscription to your Telegram account automatically.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Before checkout — get your activation code</h2>
          <div className="space-y-2 text-sm text-muted">
            <div className="flex gap-3">
              <span className="text-accent font-semibold shrink-0">1.</span>
              <p>
                Open{' '}
                <a href={botHref} target="_blank" rel="noopener noreferrer" className="text-accent font-medium hover:text-accent-hover underline underline-offset-2">
                  @sightwhale_bot
                </a>{' '}
                on Telegram and tap <span className="font-medium text-foreground">/start</span>.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-semibold shrink-0">2.</span>
              <p>Tap <span className="font-medium text-foreground">Generate Code</span>.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-semibold shrink-0">3.</span>
              <p>Paste the code here:</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Activation code input (optional when signed in) ── */}
      <div>
        <label htmlFor="activation-code" className="block text-sm font-medium text-foreground mb-1.5">
          Activation Code {isLoggedIn && <span className="text-subtle font-normal">(optional — you&apos;re signed in)</span>}
        </label>
        <input
          id="activation-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onFocus={() => trackEvent('code_input_focus', { page: 'subscribe' })}
          placeholder={isLoggedIn ? 'Not needed — leave empty' : 'ABCD1234'}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg uppercase tracking-[0.15em] text-foreground placeholder:text-subtle outline-none transition-colors focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        {hasCode && (
          <p className="mt-1.5 text-xs text-accent font-medium">Code detected — ready for checkout.</p>
        )}
      </div>

      {/* ── Plan summary ── */}
      <div className="rounded-lg border border-border bg-surface-hover px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {planLabel} · ${amount}{period === 'yearly' ? '/yr' : '/mo'}
            </p>
            <p className="text-xs text-subtle mt-0.5">7-day full refund · Cancel anytime</p>
          </div>
          <div className="text-right text-xs text-subtle">
            {plan === 'elite' ? (
              <span>Whale Score 80+ · 100 whales</span>
            ) : (
              <span>Whale Score 70+ · 20 whales</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm" role="alert">
          <p className="font-semibold text-red-700">{error.message}</p>
          <ul className="mt-2 space-y-1 text-red-600 list-disc list-inside">
            {error.actions.map((a) => <li key={a}>{a}</li>)}
          </ul>
          <a
            href="mailto:castro.liu@me.com"
            onClick={() => trackEvent('contact_support_click', { page: 'subscribe', section: 'error' })}
            className="inline-block mt-3 text-sm text-red-600 underline underline-offset-2 hover:text-red-700"
          >
            Contact support
          </a>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        ref={checkoutBtnRef}
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-4 text-base"
      >
        {loading ? 'Redirecting to Stripe…' : authLoading ? 'Checking sign-in…' : isLoggedIn && !hasCode ? 'Start Secure Checkout (no code needed)' : 'Start Secure Checkout'}
      </button>

      <p className="text-center text-xs text-subtle">
        Secure Stripe checkout · Cancel anytime ·{' '}
        <Link href="/pricing" className="text-accent hover:text-accent-hover underline underline-offset-2">Compare plans</Link>
      </p>
    </form>
  );
}

export default function SubscribePage() {
  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-24 sm:pb-32">
        {/* ── Hero ── */}
        <Suspense fallback={
          <>
            <p className="eyebrow mb-4">Subscribe</p>
            <h1 className="text-balance mb-3">Start Pro</h1>
            <p className="text-base text-muted leading-relaxed mb-8">
              Secure checkout with Stripe. Signed-in users can pay right away — no activation code needed.
            </p>
          </>
        }>
          <SubscribeHero />
        </Suspense>

        {/* ── Money-back badge ── */}
        <div className="mb-8 rounded-lg border border-accent/20 bg-accent/5 px-5 py-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold text-accent">7-day money-back guarantee.</span>{' '}
            Not satisfied? Email{' '}
            <a href="mailto:castro.liu@me.com" className="text-accent font-medium underline underline-offset-2">castro.liu@me.com</a>{' '}
            for a full refund.
          </p>
        </div>

        {/* ── Form ── */}
        <Suspense fallback={<div className="rounded-lg border border-border bg-surface p-8 text-center text-subtle">Loading checkout…</div>}>
          <SubscribeForm />
        </Suspense>
      </div>
    </div>
  );
}
