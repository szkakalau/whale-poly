'use client';

import { type ReactNode, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  PolymarketAlertsCaseStudies2026,
  PolymarketAlertsConversionAfterHero,
  PolymarketAlertsPrePricing,
} from './PolymarketAlertsConversionBlocks';
import { PolymarketAlertsPostPricingFaqAndGuarantee, PolymarketAlertsClosingCta } from './PolymarketAlertsFaqRiskClosing';
import { PolymarketAlertsPricingCompare } from './PolymarketAlertsPricingCompare';
import { trackEvent, type AnalyticsPayload } from '@/lib/analytics';

const ALERT_PREVIEW_IMAGE = '/images/alerts/ScreenShot_2026-03-29_003514_416.png';

const SUBSCRIPTION_BASE = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || '/subscribe';

function getSubscribeHref(plan: 'pro' | 'elite' = 'pro'): string {
  const base = SUBSCRIPTION_BASE.trim();
  if (base.startsWith('http://') || base.startsWith('https://')) {
    const joiner = base.includes('?') ? '&' : '?';
    return base.includes('plan=') ? base : `${base}${joiner}plan=${plan}`;
  }
  const path = base.startsWith('/') ? base : `/${base}`;
  return path.includes('?') ? `${path}&plan=${plan}` : `${path}?plan=${plan}`;
}

function PrimaryButton({
  children,
  className = '',
  plan = 'pro',
  eventName,
  eventProps,
}: {
  children: ReactNode;
  className?: string;
  plan?: 'pro' | 'elite';
  eventName?: string;
  eventProps?: AnalyticsPayload;
}) {
  const href = getSubscribeHref(plan);
  const sharedClass = `inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-3.5 text-[15px] font-semibold tracking-tight text-white transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black min-h-14 ${className}`;
  const handleClick = () => {
    if (eventName) {
      trackEvent(eventName, { plan, destination: href, source_page: 'polymarket-alerts-tl', ...eventProps });
    }
  };

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <a href={href} className={sharedClass} rel="noreferrer" onClick={handleClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={sharedClass} onClick={handleClick}>
      {children}
    </Link>
  );
}

function PostCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[#343536] bg-[#1a1a1b] p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-left text-[1.35rem] font-bold leading-snug tracking-tight text-[#d7dadc] sm:text-2xl">
      <span className="mr-2 inline-block h-[1.15em] w-1 rounded-sm bg-[#ff4500] align-middle" aria-hidden />
      {children}
    </h2>
  );
}

const HERO_POINTS = [
  'Only alerts with Whale Score 70+',
  'Telegram delivery in under 30 seconds',
  'Setup takes about 2 minutes',
  '7-day full refund if it is not useful',
] as const;

const ONBOARDING_STEPS = [
  {
    n: '01',
    title: 'Open the subscription flow',
    body: 'Tap the CTA and land on the setup page with your Pro plan pre-selected.',
  },
  {
    n: '02',
    title: 'Generate your Telegram activation code',
    body: 'Open `@sightwhale_bot`, tap Generate Code, then come back to checkout.',
  },
  {
    n: '03',
    title: 'Pay once, get alerts in Telegram',
    body: 'After checkout, alerts are delivered in Telegram with no dashboard to babysit.',
  },
] as const;

const CLARITY_CARDS = [
  { label: 'Delivery', value: 'Telegram', detail: 'No extra dashboard or inbox clutter' },
  { label: 'Speed', value: '<30s', detail: 'Built for markets that move before retail reacts' },
  { label: 'Filter', value: '70+ only', detail: 'Large bets are filtered by Whale Score' },
  { label: 'Risk', value: '7 days', detail: 'Full refund if the alerts are not useful' },
] as const;

export function HeroSection() {
  return (
    <section className="pt-10 sm:pt-16" aria-label="Hero">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Polymarket whale alerts</p>
          <h1 className="font-display mt-4 max-w-[12ch] text-balance text-[clamp(2rem,9vw,4.8rem)] font-semibold leading-[0.98] tracking-tight text-black">
            Stop trading after the move.
          </h1>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-neutral-600 sm:mt-5 sm:text-[18px]">
            SightWhale sends real-time Telegram alerts when whale-sized bets hit Polymarket, filtered so you only see
            the trades most likely to move the market.
          </p>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {HERO_POINTS.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] font-medium text-neutral-700 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
              >
                {point}
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <PrimaryButton
              className="min-h-[3.75rem] px-6 py-4 text-[16px] sm:w-auto"
              eventName="lp_cta_click"
              eventProps={{ cta_id: 'hero_primary', section: 'hero' }}
            >
              Start 7-Day Trial Setup
            </PrimaryButton>
            <a
              href="#pricing"
              onClick={() => trackEvent('lp_cta_click', { cta_id: 'hero_secondary_pricing', section: 'hero', destination: '#pricing', source_page: 'polymarket-alerts-tl' })}
              className="inline-flex min-h-[3.75rem] w-full items-center justify-center rounded-full border border-neutral-300 bg-white px-6 py-4 text-center text-[16px] font-semibold tracking-tight text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50 sm:w-auto"
            >
              See Pricing First
            </a>
          </div>

          <div className="mt-5 space-y-1.5 text-[13px] leading-relaxed text-neutral-500">
            <p>Web checkout, Telegram delivery.</p>
            <p>You will generate an activation code in Telegram before payment.</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.28)] sm:p-5">
          <div className="flex flex-col gap-2 border-b border-neutral-200 px-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">Preview</p>
              <p className="mt-1 text-sm font-semibold text-black">A real alert, delivered instantly</p>
            </div>
            <span className="w-fit rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
              Telegram
            </span>
          </div>
          <div className="mt-4 rounded-[28px] border border-neutral-200 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_38%),linear-gradient(180deg,_#eff6ff_0%,_#f8fafc_42%,_#eef2ff_100%)] p-4 sm:p-5">
            <div className="mx-auto w-full max-w-[330px] rounded-[2.5rem] border border-[#0f172a] bg-[#0b1220] p-2.5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.65)] ring-1 ring-black/10">
              <div className="flex justify-center pb-2">
                <div className="h-1.5 w-20 rounded-full bg-white/20" aria-hidden />
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-[#1e293b] bg-white">
                <div className="flex items-center justify-between bg-[#229ED9] px-4 py-2.5 text-white">
                  <div>
                    <p className="text-[11px] font-semibold leading-none">Telegram</p>
                    <p className="mt-1 text-[10px] leading-none text-white/75">SightWhale Alerts</p>
                  </div>
                  <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-medium tracking-tight text-white/90">
                    live
                  </span>
                </div>
                <Image
                  src={ALERT_PREVIEW_IMAGE}
                  alt="Example SightWhale whale alert in Telegram"
                  width={1080}
                  height={1400}
                  sizes="(max-width: 1024px) 100vw, 330px"
                  className="mx-auto h-auto w-full bg-[#e5eff8]"
                  priority
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">What you see</p>
              <p className="mt-2 text-sm font-medium text-neutral-800">Whale score, side, size, and instant context</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Why it matters</p>
              <p className="mt-2 text-sm font-medium text-neutral-800">You can decide before the crowd notices</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhaleScoreMoatSection() {
  return (
    <section className="mt-10 border-t border-neutral-200 pt-8 sm:mt-14 sm:pt-12" aria-labelledby="whale-score-moat-heading">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.65]" aria-hidden>
          <div className="absolute -left-24 -top-28 h-64 w-64 rounded-full bg-neutral-100 blur-2xl" />
          <div className="absolute -right-24 -top-16 h-56 w-56 rounded-full bg-neutral-100 blur-2xl" />
        </div>

        <p className="relative font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">
          Proprietary signal layer
        </p>
        <h2
          id="whale-score-moat-heading"
          className="relative font-display mt-3 text-balance text-[clamp(1.25rem,4.2vw,1.65rem)] font-semibold leading-tight tracking-tight text-black"
        >
          Not all whale bets are equal.
          <span className="mt-2 block text-neutral-600">We only send you the ones that move markets.</span>
        </h2>

        <div className="relative mt-6 space-y-4 border-t border-neutral-200 pt-6 text-[15px] leading-relaxed text-neutral-600">
          <p className="max-w-[74ch]">
            Any tool can show you large Polymarket trades. Only SightWhale filters the noise with our proprietary{' '}
            <span className="font-semibold text-black">Whale Score™</span>{' '}
            <span className="font-mono text-[13px] text-neutral-500">(0–100)</span>.
          </p>
          <p className="max-w-[78ch] text-[14px] text-neutral-600 sm:text-[15px]">
            Our AI-driven scoring system separates &quot;dumb large money&quot; from the top 1% of Polymarket wallets that consistently drive price action. Every alert we send has a Whale Score of{' '}
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-semibold text-black">
              70+
            </span>
            , so you skip{' '}
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-semibold text-black">
              90%
            </span>{' '}
            of the noise and only act on signals that matter.
          </p>
        </div>

        <div className="relative mt-6">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            <span>0</span>
            <span className="text-neutral-700">Whale Score™</span>
            <span>100</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
            <div
              className="h-full w-[70%] rounded-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-600"
              aria-hidden
            />
          </div>
          <div className="mt-2 flex flex-col items-center justify-center gap-1.5 font-mono text-[11px] text-neutral-500 sm:flex-row sm:gap-2">
            <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
              70+ only
            </span>
            <span>Below this — filtered out.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section className="py-14 sm:py-16">
      <PostCard>
        <SectionTitle>Retail traders are always late</SectionTitle>
        <ul className="mt-5 space-y-3 border-t border-[#343536] pt-5 text-left text-[17px] leading-relaxed text-[#d7dadc]">
          <li className="flex gap-3">
            <span className="shrink-0 font-mono text-[#ff4500]" aria-hidden>
              ▸
            </span>
            Whales move markets before odds change
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-mono text-[#ff4500]" aria-hidden>
              ▸
            </span>
            Big bets reveal real conviction
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-mono text-[#ff4500]" aria-hidden>
              ▸
            </span>
            Most traders react too late
          </li>
        </ul>
        <p className="mt-6 rounded-md border border-dashed border-[#5c2e12]/60 bg-[#1a0f08]/90 px-3 py-3 text-center text-[15px] font-medium leading-snug text-[#fec89a]">
          By the time Twitter talks about a market — whales are already in.
        </p>
        <div className="mt-6">
          <PrimaryButton>Start Whale Alerts — $29/mo</PrimaryButton>
        </div>
      </PostCard>
    </section>
  );
}

export function HowItWorksSection() {
  const lines = ['We track whale wallets', 'We detect large bets instantly', 'You get real-time alerts'];
  return (
    <section className="py-14 sm:py-16">
      <SectionTitle>How SightWhale works</SectionTitle>
      <PostCard className="mt-6">
        <ul className="space-y-4 text-left text-[17px] leading-relaxed text-[#d7dadc]">
          {lines.map((line) => (
            <li key={line} className="flex gap-3 border-b border-[#2a2a2b] pb-4 last:border-0 last:pb-0">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff4500]" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </PostCard>
    </section>
  );
}

export function MarketSpeedSection() {
  return (
    <section className="py-14 sm:py-16">
      <PostCard className="border-[#1e3a5f]/50 bg-gradient-to-br from-[#0c1520]/90 to-[#1a1a1b]">
        <SectionTitle>Markets move fast when whales enter</SectionTitle>
        <ul className="mt-5 space-y-3 border-t border-[#343536] pt-5 text-left text-[17px] leading-relaxed text-[#d7dadc]">
          <li className="flex gap-3">
            <span className="shrink-0 text-[#38bdf8]" aria-hidden>
              ◆
            </span>
            Odds can shift within minutes
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 text-[#38bdf8]" aria-hidden>
              ◆
            </span>
            Retail traders react too late
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 text-[#38bdf8]" aria-hidden>
              ◆
            </span>
            Early signals create the edge
          </li>
        </ul>
      </PostCard>
    </section>
  );
}

export function ClaritySection() {
  return (
    <section className="py-8 sm:py-12" aria-labelledby="clarity-heading">
      <div className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-[0_16px_60px_-36px_rgba(0,0,0,0.3)] sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">At a glance</p>
            <h2 id="clarity-heading" className="font-display mt-2 text-[1.75rem] font-semibold tracking-tight text-black sm:text-[2.2rem]">
              What you are actually buying
            </h2>
          </div>
          <p className="max-w-[34ch] text-sm leading-relaxed text-neutral-500">
            See the delivery method, speed, filter, and refund terms before you subscribe.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {CLARITY_CARDS.map((card) => (
            <article key={card.label} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">{card.label}</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-black">{card.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{card.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowToStartSection() {
  return (
    <section id="how-it-works" className="py-10 sm:py-16" aria-labelledby="how-to-start-heading">
      <div className="rounded-[32px] border border-neutral-200 bg-[#111214] p-6 shadow-[0_24px_90px_-42px_rgba(0,0,0,0.5)] sm:p-8 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Getting started</p>
            <h2 id="how-to-start-heading" className="font-display mt-2 text-[1.9rem] font-semibold tracking-tight text-white sm:text-[2.4rem]">
              Getting started takes about 2 minutes
            </h2>
          </div>
          <p className="max-w-[34ch] text-sm leading-relaxed text-neutral-400">
            Open the bot, generate your code, and finish checkout.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {ONBOARDING_STEPS.map((step) => (
            <article key={step.n} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">{step.n}</p>
              <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300">{step.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-sm leading-relaxed text-amber-100">
          Checkout happens on the web. Alerts are delivered in Telegram.
        </div>
      </div>
    </section>
  );
}

export function DecisionSection() {
  return (
    <section className="py-10 sm:py-16" aria-labelledby="decision-heading">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-[0_16px_70px_-40px_rgba(0,0,0,0.35)] sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Why traders use it</p>
          <h2 id="decision-heading" className="font-display mt-2 text-[1.9rem] font-semibold tracking-tight text-black sm:text-[2.35rem]">
            A faster read on whale positioning
          </h2>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-600">
            <p>Whale alerts help you spot large positioning earlier, before the crowd catches up.</p>
            <p>
              Use them to discover markets sooner, avoid late entries, and stay closer to where large money is moving.
            </p>
          </div>
        </div>

        <div className="rounded-[32px] border border-neutral-200 bg-black p-6 text-white shadow-[0_20px_80px_-46px_rgba(0,0,0,0.55)] sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-300">Why it can be worth it</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">One avoided bad entry can pay for the month.</h3>
          <p className="mt-4 text-sm leading-relaxed text-neutral-300">
            For many traders, one earlier signal or one avoided chase is enough to justify the subscription.
          </p>
          <div className="mt-6">
            <PrimaryButton
              className="bg-lime-400 text-black hover:bg-lime-300"
              eventName="lp_cta_click"
              eventProps={{ cta_id: 'decision_primary', section: 'decision' }}
            >
              Start Pro For $29/mo
            </PrimaryButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#343536] bg-[#1a1a1b]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#1a1a1b]/85">
      <div className="mx-auto max-w-md">
        <PrimaryButton
          className="min-h-[3.5rem] py-3.5 text-[16px] font-extrabold shadow-[0_-4px_28px_rgba(255,69,0,0.35)] ring-1 ring-white/10"
          eventName="lp_cta_click"
          eventProps={{ cta_id: 'sticky_primary', section: 'sticky' }}
        >
          Start 7-Day Risk-Free Trial
        </PrimaryButton>
        <p className="mt-2 text-center text-[11px] text-white/65">2-minute setup on mobile</p>
      </div>
    </div>
  );
}

export default function PolymarketAlertsTlPage() {
  useEffect(() => {
    trackEvent('lp_view', { page: 'polymarket-alerts-tl' });
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-black">
      <main className="mx-auto max-w-6xl px-4 pb-32 font-[family-name:var(--font-body)] sm:px-8 sm:pb-16">
        <HeroSection />
        <ClaritySection />
        <HowToStartSection />
        <DecisionSection />
        <WhaleScoreMoatSection />
        <div className="mt-12 space-y-6 sm:mt-16 sm:space-y-8">
          <PolymarketAlertsConversionAfterHero />
          <PolymarketAlertsCaseStudies2026 />
          <PolymarketAlertsPrePricing />
        </div>
        <div id="pricing" className="mt-12 sm:mt-16">
          <PolymarketAlertsPricingCompare />
        </div>
        <div className="mt-12 space-y-6 sm:mt-16 sm:space-y-8">
          <PolymarketAlertsPostPricingFaqAndGuarantee />
          <PolymarketAlertsClosingCta />
        </div>

        <footer className="mt-12 border-t border-neutral-200 pb-8 pt-8 text-[12px] leading-relaxed text-neutral-500 sm:pb-0">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>Pricing starts at $29/mo.</p>
            <p>Checkout happens on web. Alerts are delivered via Telegram only.</p>
          </div>
          <p className="mt-3">
            By starting a trial, you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-500">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-500">
              Privacy Policy
            </Link>
            .
          </p>
        </footer>
        <StickyCTA />
      </main>
    </div>
  );
}
