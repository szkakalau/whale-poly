'use client';

import { type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const ALERT_PREVIEW_IMAGE = '/images/alerts/ScreenShot_2026-03-29_003514_416.png';

/** Same base as `Header` — internal `/subscribe` + `/api/checkout`, or optional external payment URL. */
const SUBSCRIPTION_BASE = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || '/subscribe';

function getProSubscribeHref(): string {
  const base = SUBSCRIPTION_BASE.trim();
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return base;
  }
  const path = base.startsWith('/') ? base : `/${base}`;
  return path.includes('?') ? `${path}&plan=pro` : `${path}?plan=pro`;
}

/** High-contrast primary action — subscribe / checkout. */
function PrimaryButton({ children, className = '' }: { children: ReactNode; className?: string }) {
  const href = getProSubscribeHref();
  const sharedClass = `inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-3.5 text-[15px] font-semibold tracking-tight text-white transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black min-h-14 ${className}`;

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <a href={href} className={sharedClass}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={sharedClass}>
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

export function HeroSection() {
  return (
    <section className="pt-14 sm:pt-16" aria-label="Hero">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Polymarket whale alerts</p>
      <h1 className="font-display mt-4 text-balance text-[clamp(2.1rem,6.4vw,3.35rem)] font-semibold leading-[1.02] tracking-tight text-black">
        Stop being exit liquidity.
      </h1>
      <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-neutral-600 sm:text-[17px]">
        Real-time Telegram alerts when whale-sized bets hit Polymarket — so you can act before the price moves.
      </p>

      <div className="mt-8 max-w-sm">
        <PrimaryButton className="min-h-[3.75rem] py-4 text-[16px]">Start 7-Day Risk-Free Trial</PrimaryButton>
      </div>

      <div className="mt-6 space-y-1.5 text-[13px] leading-relaxed text-neutral-500">
        <p>7-day full refund. No questions asked.</p>
        <p>Cancel anytime. No contracts.</p>
      </div>
    </section>
  );
}

/** Second screen: proprietary Whale Score™ moat — placed before live alert examples. */
export function WhaleScoreMoatSection() {
  return (
    <section className="mt-12 border-t border-neutral-200 pt-10 sm:mt-14 sm:pt-12" aria-labelledby="whale-score-moat-heading">
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

        {/* 0–100 scale — ties visually to “70+” / “90% noise” copy */}
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
          <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[11px] text-neutral-500">
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

export function PreviewSection() {
  return (
    <section className="mt-12 border-t border-neutral-200 pt-10 sm:mt-14 sm:pt-12" aria-label="Preview">
      <div className="flex items-end justify-between gap-6">
        <h2 className="font-display text-[18px] font-semibold tracking-tight text-black sm:text-[20px]">
          A real alert, delivered instantly
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Telegram</p>
      </div>
      <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-neutral-600">
        You get the message the moment whales enter — before the odds move.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Preview</span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
            screenshot
          </span>
        </div>
        <div className="bg-neutral-50">
          <Image
            src={ALERT_PREVIEW_IMAGE}
            alt="Example SightWhale whale alert in Telegram"
            width={1080}
            height={1400}
            sizes="(max-width: 640px) 100vw, 720px"
            className="h-auto w-full object-cover object-top"
            priority={false}
          />
        </div>
      </div>
    </section>
  );
}

export function ValueSection() {
  return (
    <section className="py-14 sm:py-16">
      <PostCard>
        <SectionTitle>Why traders use whale alerts</SectionTitle>
        <ul className="mt-5 space-y-2.5 text-left text-[17px] leading-relaxed text-[#d7dadc]">
          <li className="flex gap-2">
            <span className="text-[#7193ff]" aria-hidden>
              ↗
            </span>{' '}
            Spot momentum early
          </li>
          <li className="flex gap-2">
            <span className="text-[#7193ff]" aria-hidden>
              ↗
            </span>{' '}
            Follow smart money
          </li>
          <li className="flex gap-2">
            <span className="text-[#7193ff]" aria-hidden>
              ↗
            </span>{' '}
            Avoid emotional trading
          </li>
          <li className="flex gap-2">
            <span className="text-[#7193ff]" aria-hidden>
              ↗
            </span>{' '}
            Save hours of manual tracking
          </li>
        </ul>
      </PostCard>
    </section>
  );
}

export function FounderTrustSection() {
  return (
    <section className="py-14 sm:py-16">
      <PostCard className="border-[#3d2a1f]/80 bg-[#141210]">
        <SectionTitle>Built by a Polymarket trader</SectionTitle>
        <div className="mt-5 space-y-4 border-t border-[#343536] pt-5 text-[17px] leading-relaxed text-[#d7dadc]">
          <p>I built SightWhale after spending hours manually tracking whale wallets.</p>
          <p className="text-[#b8b9ba]">Now early members get the same alerts I use every day.</p>
        </div>
      </PostCard>
    </section>
  );
}

export function SocialProofSection() {
  return (
    <section className="py-14 sm:py-16">
      <PostCard className="border-[#3d2a1f] bg-gradient-to-br from-[#1f1410]/80 to-[#1a1a1b]">
        <SectionTitle>Early users are joining every week</SectionTitle>
        <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-[#d7dadc]">
          <p>You&apos;re getting access at the founding member price.</p>
          <p className="text-[#b8b9ba]">The product is improving fast with early members.</p>
        </div>
        <div className="mt-6">
          <PrimaryButton>Join the early group — $29/mo</PrimaryButton>
        </div>
      </PostCard>
    </section>
  );
}

export function PricingSection() {
  return (
    <section className="py-14 sm:py-16">
      <PostCard className="relative overflow-hidden border-[#ff4500]/35">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#ff4500]/15 blur-2xl" aria-hidden />
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff4500]">Founding member</p>
        <h2 className="font-display mt-2 text-2xl font-bold text-white">Founding Member Pricing</h2>
        <p className="mt-3 rounded-md border border-[#343536] bg-[#0d0d0d] px-3 py-2 text-center font-mono text-[13px] font-medium text-[#a3e635]/95">
          Less than one bad trade per month
        </p>
        <p className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white">
          $29 <span className="text-lg font-semibold text-[#818384]">/ month</span>
        </p>
        <ul className="mt-6 space-y-2.5 border-t border-[#343536] pt-5 text-left text-[17px] text-[#d7dadc]">
          <li className="flex gap-2">
            <span className="text-[#ff4500]">✓</span> Real-time whale alerts
          </li>
          <li className="flex gap-2">
            <span className="text-[#ff4500]">✓</span> Track smart money wallets
          </li>
          <li className="flex gap-2">
            <span className="text-[#ff4500]">✓</span> Early member pricing
          </li>
          <li className="flex gap-2">
            <span className="text-[#ff4500]">✓</span> Direct founder support
          </li>
        </ul>
        <div className="mt-8">
          <PrimaryButton>Start tracking whales</PrimaryButton>
        </div>
        <p className="mt-5 text-center font-mono text-[13px] text-[#6f7071]">Cancel anytime. No commitment.</p>
      </PostCard>
    </section>
  );
}

export function UrgencySection() {
  return (
    <section className="py-12 sm:py-14">
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-4 text-center">
        <p className="text-[16px] leading-relaxed text-[#fbbf24]/90">
          Founding price available for early users.
          <br />
          <span className="text-[#d7dadc]">Price increases once the early group fills.</span>
        </p>
      </div>
    </section>
  );
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'How do I receive alerts?',
    a: 'Telegram only. Connect Telegram in the app to receive alerts — email is not supported.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. One-click cancel. No lock-in.',
  },
  {
    q: 'Is this beginner friendly?',
    a: 'Yes. Alerts are simple and real-time.',
  },
];

export function FAQSection() {
  return (
    <section className="py-14 sm:py-16">
      <SectionTitle>Frequently asked questions</SectionTitle>
      <div className="mt-6 space-y-2">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-lg border border-[#343536] bg-[#1a1a1b] px-4 py-1 open:pb-3 open:pt-2 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 py-3 font-display text-[16px] font-semibold text-white marker:content-none">
              <span className="font-mono text-[#ff4500] transition-transform group-open:rotate-90" aria-hidden>
                ▸
              </span>
              {item.q}
            </summary>
            <p className="border-t border-[#343536] pb-1 pl-7 pt-3 text-[16px] leading-relaxed text-[#b8b9ba]">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCTASection() {
  return (
    <section className="pb-36 pt-8 sm:pb-40">
      <PostCard>
        <h2 className="font-display text-center text-[1.4rem] font-bold leading-snug text-white sm:text-2xl">
          Stop trading blind.
          <br />
          <span className="text-[#ff4500]">Start following whales.</span>
        </h2>
        <div className="mt-8">
          <PrimaryButton>Get Whale Alerts — $29/mo</PrimaryButton>
        </div>
        <p className="mt-5 text-center font-mono text-[13px] text-[#818384]">Takes less than 30 seconds to join.</p>
      </PostCard>
    </section>
  );
}

export function StickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#343536] bg-[#1a1a1b]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#1a1a1b]/85">
      <div className="mx-auto max-w-md">
        <PrimaryButton className="min-h-[3.5rem] py-3.5 text-[16px] font-extrabold shadow-[0_-4px_28px_rgba(255,69,0,0.35)] ring-1 ring-white/10">
          Start 7-Day Risk-Free Trial
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function PolymarketAlertsTlPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      <main className="mx-auto max-w-2xl px-5 pb-16 font-[family-name:var(--font-body)] sm:px-8">
        <HeroSection />
        <WhaleScoreMoatSection />
        <PreviewSection />

        <footer className="mt-12 border-t border-neutral-200 pt-8 text-[12px] leading-relaxed text-neutral-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>Pricing: $29/mo.</p>
            <p>Alerts are delivered via Telegram only.</p>
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
      </main>
    </div>
  );
}
