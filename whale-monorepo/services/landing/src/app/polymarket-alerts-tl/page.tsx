'use client';

import type { ReactNode } from 'react';
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

function PrimaryButton({ children, className = '' }: { children: ReactNode; className?: string }) {
  const href = getProSubscribeHref();
  const sharedClass = `inline-flex w-full items-center justify-center rounded-full bg-[#ff4500] px-5 py-3.5 text-base font-bold tracking-tight text-white shadow-[0_6px_28px_rgba(255,69,0,0.38)] transition-[transform,box-shadow] hover:scale-[1.02] hover:bg-[#ff5417] hover:shadow-[0_8px_32px_rgba(255,69,0,0.45)] active:scale-[0.99] min-h-14 ${className}`;

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
    <section className="pt-10 pb-14 sm:pt-14 sm:pb-16">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#343536] bg-[#272729] px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#818384]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff4500]" aria-hidden />
          r/Polymarket vibes
        </span>
        <span className="text-[13px] text-[#6f7071]">· no fluff, just flow</span>
      </div>
      <h1 className="font-display text-balance text-[1.75rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl">
        Follow Polymarket whales{' '}
        <span className="text-[#ff4500] underline decoration-[#ff4500]/40 decoration-2 underline-offset-4">in real time</span>
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-[#d7dadc]">
        Get instant alerts when smart money places big bets.
        <br />
        <span className="text-[#818384]">Stop trading blind.</span>
      </p>
      <div className="mt-8">
        <PrimaryButton>Start Whale Alerts — $29/mo</PrimaryButton>
      </div>
      <p className="mt-5 text-center font-mono text-[13px] leading-relaxed text-[#818384]">
        Join early users tracking smart money
        <br />
        Cancel anytime
      </p>
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
            Most traders see it too late
          </li>
        </ul>
        <p className="mt-6 rounded-md border border-dashed border-[#343536] bg-[#0d0d0d] px-3 py-2.5 text-center text-[15px] font-medium text-[#d7dadc]">
          Now you see what whales do — instantly.
        </p>
      </PostCard>
    </section>
  );
}

export function HowItWorksSection() {
  const cards = [
    {
      title: 'Track whale wallets',
      body: 'We monitor large Polymarket traders',
    },
    {
      title: 'Detect big bets',
      body: 'We spot high-value trades in seconds',
    },
    {
      title: 'Send instant alerts',
      body: 'You get notified in real time',
    },
  ];
  return (
    <section className="py-14 sm:py-16">
      <SectionTitle>How SightWhale works</SectionTitle>
      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-[#6f7071]">three steps · same as always</p>
      <div className="mt-6 space-y-3">
        {cards.map((c, i) => (
          <PostCard key={c.title} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#272729] font-mono text-sm font-bold text-[#ff4500]">
              {i + 1}
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-white">{c.title}</p>
              <p className="mt-1 text-[17px] leading-relaxed text-[#818384]">{c.body}</p>
            </div>
          </PostCard>
        ))}
      </div>
    </section>
  );
}

export function PreviewSection() {
  return (
    <section className="py-14 sm:py-16">
      <SectionTitle>Real whale alerts look like this</SectionTitle>
      <p className="mt-3 text-[17px] leading-relaxed text-[#818384]">You receive alerts the moment whales enter a market.</p>
      <PostCard className="mt-6 overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[#343536] bg-[#272729] px-3 py-2">
          <span className="font-mono text-[11px] text-[#818384]">telegram · preview</span>
          <span className="ml-auto rounded bg-[#1a1a1b] px-2 py-0.5 font-mono text-[10px] text-[#6f7071]">screenshot</span>
        </div>
        <div className="bg-[#0d0d0d]">
          <Image
            src={ALERT_PREVIEW_IMAGE}
            alt="Example SightWhale whale alert in Telegram"
            width={1080}
            height={1400}
            sizes="(max-width: 448px) 100vw, 448px"
            className="h-auto w-full object-cover object-top"
            priority={false}
          />
        </div>
      </PostCard>
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

export function SocialProofSection() {
  return (
    <section className="py-14 sm:py-16">
      <PostCard className="border-[#3d2a1f] bg-gradient-to-br from-[#1f1410]/80 to-[#1a1a1b]">
        <SectionTitle>Early members are joining</SectionTitle>
        <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-[#d7dadc]">
          <p>You&apos;re getting access at the founding member price.</p>
          <p>Built by an active Polymarket trader.</p>
          <p>Continuously improving with early users.</p>
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
          Founding member spots are limited.
          <br />
          <span className="text-[#d7dadc]">Price will increase as more users join.</span>
        </p>
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
        <PrimaryButton className="shadow-[0_-4px_24px_rgba(0,0,0,0.45)]">Start Whale Alerts — $29/mo</PrimaryButton>
      </div>
    </div>
  );
}

export default function PolymarketAlertsTlPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#030303] text-[#d7dadc]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-gradient-to-b from-[#ff4500]/[0.07] via-transparent to-transparent" aria-hidden />
      <main className="relative z-10 mx-auto max-w-md px-4 pb-4 font-[family-name:var(--font-body)]">
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <PreviewSection />
        <ValueSection />
        <SocialProofSection />
        <PricingSection />
        <UrgencySection />
        <FinalCTASection />
      </main>
      <StickyCTA />
    </div>
  );
}
