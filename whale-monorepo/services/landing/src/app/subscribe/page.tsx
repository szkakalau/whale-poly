'use client';

import { useState, useEffect, useMemo, useRef, useSyncExternalStore, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { trackEvent } from '@/lib/analytics';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';
const SUBSCRIBE_START_PARAM = 'subscribe_pro';

type PaidTier = 'pro' | 'elite';
type Mode = 'paid' | 'free';
type BillingPeriod = 'monthly' | 'yearly';

const PLAN_COPY: Record<
  PaidTier,
  {
    label: string;
    monthlyPrice: number;
    yearlyPrice: number;
    monthlySuffix: string;
    yearlySuffix: string;
    kicker: string;
    description: string;
    features: string[];
  }
> = {
  pro: {
    label: 'Pro',
    monthlyPrice: 29,
    yearlyPrice: 290,
    monthlySuffix: '/mo',
    yearlySuffix: '/yr',
    kicker: 'Best for most traders',
    description: 'Real-time whale alerts for traders who want speed without extra complexity.',
    features: ['Unlimited alerts', 'Zero alert delay', 'Follow up to 20 whales', '5 smart collections'],
  },
  elite: {
    label: 'Elite',
    monthlyPrice: 59,
    yearlyPrice: 590,
    monthlySuffix: '/mo',
    yearlySuffix: '/yr',
    kicker: 'Priority for active traders',
    description: 'Everything in Pro, plus more coverage and priority for heavier users.',
    features: ['Everything in Pro', 'Follow up to 100 whales', '20 smart collections', 'Priority updates'],
  },
};

const FREE_PLAN_FEATURES = ['3 alerts per day', '10-minute alert delay', 'No smart collections'];

function getPlanAmount(tier: PaidTier, period: BillingPeriod): number {
  return period === 'yearly' ? PLAN_COPY[tier].yearlyPrice : PLAN_COPY[tier].monthlyPrice;
}

function getPlanSuffix(tier: PaidTier, period: BillingPeriod): string {
  return period === 'yearly' ? PLAN_COPY[tier].yearlySuffix : PLAN_COPY[tier].monthlySuffix;
}

function resolveBotDomain(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    if (u.hostname === 't.me' && u.pathname.length > 1) {
      const seg = u.pathname.replace(/^\//, '').split('/')[0];
      if (seg) return seg;
    }
  } catch {
    /* ignore */
  }
  return 'sightwhale_bot';
}

function isLikelyInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|LinkedInApp|Snapchat/i.test(ua);
}

const NARROW_QUERY = '(max-width: 639px)';

function subscribeNarrowViewport(onStoreChange: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getNarrowViewportSnapshot() {
  return window.matchMedia(NARROW_QUERY).matches;
}

function TelegramActivationLinks() {
  const { httpsUrl, tgAppUrl } = useMemo(() => {
    const httpsUrl = `${TELEGRAM_BOT_URL}?start=${SUBSCRIBE_START_PARAM}`;
    const domain = resolveBotDomain(TELEGRAM_BOT_URL);
    const tgAppUrl = `tg://resolve?domain=${encodeURIComponent(domain)}&start=${SUBSCRIBE_START_PARAM}`;
    return { httpsUrl, tgAppUrl };
  }, []);

  const isNarrow = useSyncExternalStore(subscribeNarrowViewport, getNarrowViewportSnapshot, () => false);
  const showWebViewHint = useSyncExternalStore(
    () => () => {},
    isLikelyInAppBrowser,
    () => false
  );
  const [copied, setCopied] = useState(false);

  async function copyBotLink() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      trackEvent('telegram_link_copy', { page: 'subscribe', source: 'subscribe_sidebar' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const webLinkProps = isNarrow
    ? ({ rel: 'noopener noreferrer' } as const)
    : ({ target: '_blank' as const, rel: 'noopener noreferrer' as const });

  return (
    <div className="space-y-4 sm:space-y-5">
      {showWebViewHint ? (
        <div
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100/95 sm:text-sm"
          role="status"
        >
          If the button does not open Telegram, use your browser&apos;s menu to open this page in Safari or Chrome, then
          try again.
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Step 1</p>
        <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">Open Telegram and generate your code</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Open{' '}
          <a
            href={httpsUrl}
            {...webLinkProps}
            className="font-medium text-violet-400 underline decoration-violet-500/30 underline-offset-4 hover:text-violet-300"
          >
            @sightwhale_bot
          </a>{' '}
          and run <code className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-violet-300">/start</code>.
          Then tap <span className="font-medium text-white">Generate Code</span>.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <a
            href={httpsUrl}
            {...webLinkProps}
            onClick={() => trackEvent('telegram_open_click', { page: 'subscribe', source: 'step_1_primary', url_type: 'https' })}
            className="btn-primary inline-flex min-h-[48px] w-full items-center justify-center px-4 py-3.5 text-center text-base shadow-lg transition-all active:scale-[0.98] sm:text-lg"
          >
            Open @sightwhale_bot in Telegram
          </a>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={tgAppUrl}
              onClick={() => trackEvent('telegram_open_click', { page: 'subscribe', source: 'step_1_secondary', url_type: 'tg' })}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-gray-200 transition-colors hover:border-white/25 hover:bg-white/10"
            >
              Open in Telegram app
            </a>
            <button
              type="button"
              onClick={copyBotLink}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-gray-200 transition-colors hover:border-white/25 hover:bg-white/10"
            >
              {copied ? 'Link copied' : 'Copy bot link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscribeForm() {
  const searchParams = useSearchParams();
  const checkoutButtonRef = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<Mode>('paid');
  const [tier, setTier] = useState<PaidTier>('pro');
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; actions: string[] } | null>(null);

  useEffect(() => {
    const p = (searchParams.get('plan') || '').toLowerCase();
    const codeFromUrl = (searchParams.get('code') || '').trim();
    const periodFromUrl = (searchParams.get('period') || '').toLowerCase();

    if (p === 'free') {
      setMode('free');
      setTier('pro');
    } else if (p === 'elite' || p === 'institutional') {
      setMode('paid');
      setTier('elite');
    } else {
      setMode('paid');
      setTier('pro');
    }

    if (periodFromUrl === 'yearly' || periodFromUrl === 'annual') {
      setPeriod('yearly');
    } else if (periodFromUrl === 'monthly') {
      setPeriod('monthly');
    }

    if (codeFromUrl && !code) {
      setCode(codeFromUrl.toUpperCase());
    }
  }, [searchParams, code]);

  const sanitizedCode = code.replace(/\s+/g, '').toUpperCase();
  const hasCode = sanitizedCode.length >= 6;
  const selectedPlan = PLAN_COPY[tier];
  const selectedAmount = getPlanAmount(tier, period);
  const selectedSuffix = getPlanSuffix(tier, period);
  const yearlySavings = tier === 'pro' ? 58 : 118;

  useEffect(() => {
    if (hasCode) {
      trackEvent('activation_code_detected', { page: 'subscribe', source: 'input', mode });
    }
  }, [hasCode, mode]);

  useEffect(() => {
    const codeFromUrl = (searchParams.get('code') || '').trim();
    if (!codeFromUrl || mode !== 'paid' || !hasCode) return;

    const button = checkoutButtonRef.current;
    if (!button) return;

    const rafId = window.requestAnimationFrame(() => {
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      button.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [searchParams, hasCode, mode]);

  function mapCheckoutError(detail: unknown, status: number): { message: string; actions: string[] } {
    const raw = typeof detail === 'string' ? detail : '';
    const normalized = raw.toLowerCase();

    if (!normalized) {
      if (status === 429) {
        return {
          message: 'Too many attempts. Please wait a moment before trying again.',
          actions: ['Wait 60 seconds and resubmit.', 'Keep the same activation code from Telegram.'],
        };
      }
      return {
        message: 'Checkout failed. Please try again.',
        actions: ['Confirm your Telegram activation code is valid.', 'Retry in a moment.'],
      };
    }

    if (normalized.includes('invalid json') || normalized === 'invalid_json') {
      return {
        message: 'Something went wrong with the request.',
        actions: ['Refresh the page and retry.', 'Make sure your activation code is complete.'],
      };
    }
    if (normalized.includes('telegram_activation_code and plan are required')) {
      return {
        message: 'Activation code and plan are required.',
        actions: ['Enter your Telegram activation code.', 'Select a plan and billing period.'],
      };
    }
    if (normalized.includes('payment api unreachable') || normalized.includes('payment api returned non-json')) {
      return {
        message: 'Payment service is temporarily unavailable.',
        actions: ['Wait a few minutes and try again.', 'If this repeats, contact support.'],
      };
    }
    if (normalized.includes('activation') && normalized.includes('code')) {
      return {
        message: 'Activation code was not accepted.',
        actions: ['Open @sightwhale_bot and generate a new code.', 'Paste the full code and retry.'],
      };
    }
    if (normalized.includes('invalid plan')) {
      return {
        message: 'Selected plan is not available right now.',
        actions: ['Switch to Pro or Elite and retry.', 'If this looks wrong, contact support.'],
      };
    }
    if (normalized.includes('payment_api_base_url is required')) {
      return {
        message: 'Subscription service is not configured yet.',
        actions: ['Try again later.', 'Contact support if you need immediate access.'],
      };
    }
    return {
      message: 'Checkout failed.',
      actions: ['Retry in a minute.', 'Contact support if the issue persists.'],
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'free') {
      try {
        const res = await fetch('/api/upgrade', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan: 'FREE' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
        trackEvent('checkout_error', { page: 'subscribe', mode: 'free', stage: 'upgrade', status: res.status });
          setError({
            message: typeof data.error === 'string' ? data.error : 'Activation failed.',
            actions: ['Retry in a moment.', 'Contact support if this keeps happening.'],
          });
          return;
        }
        window.location.href = '/follow';
      } catch {
        trackEvent('checkout_error', { page: 'subscribe', mode: 'free', stage: 'network' });
        setError({
          message: 'Network error while activating Free plan.',
          actions: ['Check your connection and retry.', 'Contact support if the issue persists.'],
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    const planName = period === 'yearly' ? `${tier}_yearly` : tier;
    trackEvent('checkout_start', { page: 'subscribe', tier, period, amount: selectedAmount });

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegram_activation_code: sanitizedCode, plan: planName }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string;
        checkout_url?: string;
      };

      if (!res.ok) {
        trackEvent('checkout_error', { page: 'subscribe', mode: 'paid', stage: 'api', status: res.status, tier, period });
        setError(mapCheckoutError(data.detail, res.status));
        return;
      }

      const url = String(data.checkout_url || '');
      if (!url) {
        trackEvent('checkout_error', { page: 'subscribe', mode: 'paid', stage: 'missing_checkout_url', tier, period });
        setError({
          message: 'Checkout session could not be created.',
          actions: ['Retry in a moment.', 'Contact support if the issue persists.'],
        });
        return;
      }

      window.location.href = url;
    } catch {
      trackEvent('checkout_error', { page: 'subscribe', mode: 'paid', stage: 'network', tier, period });
      setError({
        message: 'Network error while starting checkout.',
        actions: ['Check your connection and retry.', 'Contact support if the issue persists.'],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-6 rounded-[28px] border border-white/10 p-5 sm:p-6">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">Step 2</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Paste your activation code</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              hasCode ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'
            }`}
          >
            {hasCode ? 'Code detected' : 'Waiting for code'}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Return from Telegram after tapping <span className="font-medium text-white">Generate Code</span>. If Telegram
          sends you back here with a deep link, the field will auto-fill.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-gray-400">Activation Code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={mode === 'free' ? 'Not required for Free' : 'ABCD1234'}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-lg uppercase tracking-[0.14em] text-white outline-none transition-all focus:border-violet-500/60"
          required={mode === 'paid'}
          disabled={mode === 'free'}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="text-xs text-gray-500">
          {mode === 'paid'
            ? 'You need this code before checkout can start.'
            : 'Free mode skips payment and does not need a code.'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm text-gray-400">Plan</label>
          <button
            type="button"
            onClick={() => {
              const nextMode: Mode = mode === 'paid' ? 'free' : 'paid';
              setMode(nextMode);
              trackEvent('plan_mode_toggle', { page: 'subscribe', mode: nextMode });
            }}
            className="text-xs font-medium text-gray-400 underline decoration-white/15 underline-offset-4 hover:text-gray-200"
          >
            {mode === 'paid' ? 'Prefer free first?' : 'Switch back to paid'}
          </button>
        </div>

        {mode === 'paid' ? (
          <div className="grid grid-cols-1 gap-3">
            {(['pro', 'elite'] as const).map((planKey) => {
              const plan = PLAN_COPY[planKey];
              const selected = tier === planKey;
              const amount = getPlanAmount(planKey, period);
              const suffix = getPlanSuffix(planKey, period);

              return (
                <button
                  key={planKey}
                  type="button"
                  onClick={() => {
                    setTier(planKey);
                    trackEvent('plan_select', { page: 'subscribe', mode: 'paid', tier: planKey, period });
                  }}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    selected
                      ? 'border-violet-400 bg-violet-500/12 shadow-[0_0_0_1px_rgba(167,139,250,0.18)]'
                      : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">{plan.kicker}</p>
                      <h3 className="mt-1 text-xl font-semibold text-white">{plan.label}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tracking-tight text-white">${amount}</p>
                      <p className="text-xs text-gray-400">{suffix}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-300">{plan.description}</p>
                  <ul className="mt-4 grid gap-2 text-xs text-gray-300 sm:grid-cols-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Starter access</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Free</h3>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tracking-tight text-white">$0</p>
                <p className="text-xs text-gray-400">No card</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              Use this only if you want to explore before paying. It is intentionally limited and slower than the paid
              plans.
            </p>
            <ul className="mt-4 grid gap-2 text-xs text-gray-300 sm:grid-cols-2">
              {FREE_PLAN_FEATURES.map((feature) => (
                <li key={feature} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={`space-y-3 ${mode === 'free' ? 'opacity-60' : ''}`}>
        <label className="text-sm text-gray-400">Billing</label>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1">
          {(['monthly', 'yearly'] as const).map((value) => {
            const active = period === value;
            const isYearly = value === 'yearly';

            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPeriod(value);
                  trackEvent('billing_select', { page: 'subscribe', mode, tier, period: value });
                }}
                disabled={mode === 'free'}
                className={`rounded-xl px-4 py-3 text-left transition-all ${
                  active ? 'bg-white text-black' : 'text-gray-300 hover:bg-white/5'
                } disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold capitalize">{value}</span>
                  {isYearly && mode === 'paid' ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        active ? 'bg-black text-white' : 'bg-violet-500/20 text-violet-200'
                      }`}
                    >
                      Save ${yearlySavings}
                    </span>
                  ) : null}
                </div>
                <p className={`mt-1 text-xs ${active ? 'text-black/70' : 'text-gray-500'}`}>
                  {mode === 'paid' ? `$${getPlanAmount(tier, value)} ${getPlanSuffix(tier, value)}` : 'Paid plans only'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Step 3</p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {mode === 'free' ? 'Activate free access' : 'Proceed to secure checkout'}
            </h3>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-2xl font-bold tracking-tight text-white">{mode === 'free' ? '$0' : `$${selectedAmount}`}</p>
            <p className="text-xs text-emerald-200/80">{mode === 'free' ? 'No payment' : selectedSuffix}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          {mode === 'free'
            ? 'Free gets you a limited preview with no card required.'
            : `${selectedPlan.label} includes a 7-day full refund. If the alerts are not useful, email support and get your money back.`}
        </p>
      </div>

      {error ? (
        <div className="space-y-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
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
        ref={checkoutButtonRef}
        type="submit"
        disabled={loading || (mode === 'paid' && !hasCode)}
        className="btn-primary w-full py-4 text-base shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] sm:text-lg"
      >
        {loading
          ? mode === 'free'
            ? 'Activating...'
            : 'Redirecting to checkout...'
          : mode === 'free'
            ? 'Activate Free Access'
            : `Continue to Checkout - $${selectedAmount}${selectedSuffix}`}
      </button>

      <div className="space-y-2 text-center text-xs text-gray-500">
        <p>{mode === 'free' ? 'No card required.' : 'Secure web checkout. Cancel anytime.'}</p>
        <Link href="/" className="inline-block transition-colors hover:text-gray-300">
          ← Back to home
        </Link>
      </div>
    </form>
  );
}

function CheckoutSidebar() {
  return (
    <aside className="order-2 space-y-6 lg:order-1">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">How this works</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Get from click to checkout fast</h2>
        <div className="mt-5 space-y-4">
          {[
            'Open the bot in Telegram.',
            'Tap Generate Code.',
            'Come back here and paste the code.',
            'Pay on the web and receive alerts in Telegram.',
          ].map((line, index) => (
            <div key={line} className="flex gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-200">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-gray-300">{line}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden lg:block">
        <TelegramActivationLinks />
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">Why users complete payment</p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-300">
          <li className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">Refund window removes first-week risk.</li>
          <li className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">Telegram delivery means no dashboard setup after checkout.</li>
          <li className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">The paid plans remove alert delay, which is where most of the value lives.</li>
        </ul>
      </div>
    </aside>
  );
}

export default function SubscribePage() {
  useEffect(() => {
    trackEvent('subscribe_view', { page: 'subscribe' });
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-[#0a0a0a] text-gray-100 selection:bg-violet-500/30">
      <Header />
      <main className="relative mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:py-28">
        <div className="absolute top-0 right-0 -z-10 h-64 w-64 rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 -z-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-[100px]" />

        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">Subscribe</p>
          <h1 className="mt-3 text-[34px] font-bold tracking-tight text-white text-balance sm:text-5xl">
            Finish setup without guesswork
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-gray-400 sm:text-lg">
            This page exists to get you through the only real friction in the funnel: generating your Telegram activation
            code, choosing a plan, and starting checkout without confusion.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-8">
          <CheckoutSidebar />

          <div className="order-1 space-y-5 lg:order-2 lg:space-y-6">
            <div className="lg:hidden">
              <TelegramActivationLinks />
            </div>

            <Suspense
              fallback={
                <div className="glass rounded-[28px] border border-white/10 p-8 text-center text-gray-500 sm:p-12">
                  Loading checkout options...
                </div>
              }
            >
              <SubscribeForm />
            </Suspense>

            <section className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Plan differences you can verify</h2>
                  <p className="mt-2 text-xs text-gray-400">Limits are enforced in-product and visible after activation.</p>
                </div>
                <p className="text-xs text-gray-500">Paid plans are optimized for speed, not browsing.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Free</div>
                  <div className="mt-2 text-lg font-semibold text-white">$0</div>
                  <ul className="mt-3 space-y-2 text-xs text-gray-400">
                    <li>3 alerts per day</li>
                    <li>10-minute alert delay</li>
                    <li>No whale follows</li>
                    <li>No smart collections</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-violet-200">Pro</div>
                  <div className="mt-2 text-lg font-semibold text-white">$29/mo · $290/yr</div>
                  <ul className="mt-3 space-y-2 text-xs text-gray-300">
                    <li>Unlimited alerts</li>
                    <li>Zero alert delay</li>
                    <li>Follow up to 20 whales</li>
                    <li>Subscribe to 5 smart collections</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-cyan-200">Elite</div>
                  <div className="mt-2 text-lg font-semibold text-white">$59/mo · $590/yr</div>
                  <ul className="mt-3 space-y-2 text-xs text-gray-200">
                    <li>Everything in Pro</li>
                    <li>Follow up to 100 whales</li>
                    <li>Subscribe to 20 smart collections</li>
                    <li>Priority updates</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
