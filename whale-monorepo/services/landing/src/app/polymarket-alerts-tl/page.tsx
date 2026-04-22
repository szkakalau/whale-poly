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

export function HeroSection() {
  return (
    <section className="pt-14 sm:pt-16" aria-label="Hero">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Polymarket whale alerts</p>
      <h1 className="font-display mt-4 text-balance text-[clamp(2.1rem,6.4vw,3.35rem)] font-semibold leading-[1.02] tracking-tight text-black">
        Stop being exit liquidity.
      </h1>
      <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-neutral-600 sm:text-[17px]">
        Real-time Telegram alerts when whale-sized bets hit Polymarket — so you can act before the price moves.
      </p>

      <div className="mt-8">
        <PrimaryButton className="min-h-[3.75rem] py-4 text-[16px]">Start 7-Day Risk-Free Trial</PrimaryButton>
      </div>

      <div className="mt-6 space-y-2 text-[13px] leading-relaxed text-neutral-500">
        <p>7-day full refund. No questions asked.</p>
        <p>Cancel anytime. No contracts.</p>
      </div>
    </section>
  );
}

export function PreviewSection() {
  return (
    <section className="mt-14 border-t border-neutral-200 pt-10 sm:mt-16 sm:pt-12" aria-label="Preview">
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

export default function PolymarketAlertsTlPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      <main className="mx-auto max-w-2xl px-5 pb-16 font-[family-name:var(--font-body)] sm:px-8">
        <HeroSection />
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
