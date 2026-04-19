'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

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
  const sharedClass = `inline-flex w-full items-center justify-center rounded-2xl bg-black px-6 text-lg font-semibold text-white shadow-lg transition-all hover:scale-105 h-14 ${className}`;

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
    <section className="py-20 text-center">
      <h1 className="text-4xl font-bold text-gray-900">Follow Polymarket whales in real time</h1>
      <p className="mt-4 text-lg text-gray-600">
        Get instant alerts when smart money places big bets.
        <br />
        Stop trading blind.
      </p>
      <div className="mt-8">
        <PrimaryButton>Start Whale Alerts — $29/mo</PrimaryButton>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        Join early users tracking smart money
        <br />
        Cancel anytime
      </p>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section className="py-20 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">Retail traders are always late</h2>
      <ul className="mx-auto mt-6 max-w-sm list-disc space-y-3 pl-5 text-left text-lg text-gray-600">
        <li>Whales move markets before odds change</li>
        <li>Big bets reveal real conviction</li>
        <li>Most traders see it too late</li>
      </ul>
      <p className="mt-8 text-lg text-gray-600">Now you see what whales do — instantly.</p>
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
    <section className="py-20 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">How SightWhale works</h2>
      <div className="mt-10 space-y-6 text-left">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-6">
            <p className="text-lg font-semibold text-gray-900">{c.title}</p>
            <p className="mt-2 text-lg text-gray-600">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PreviewSection() {
  return (
    <section className="py-20 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">Real whale alerts look like this</h2>
      <p className="mt-4 text-lg text-gray-600">You receive alerts the moment whales enter a market.</p>
      <div
        className="mt-8 flex min-h-[200px] items-center justify-center rounded-2xl bg-gray-200 text-sm text-gray-500"
        aria-hidden
      >
        Alert preview
      </div>
    </section>
  );
}

export function ValueSection() {
  return (
    <section className="py-20 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">Why traders use whale alerts</h2>
      <ul className="mx-auto mt-6 max-w-sm list-disc space-y-3 pl-5 text-left text-lg text-gray-600">
        <li>Spot momentum early</li>
        <li>Follow smart money</li>
        <li>Avoid emotional trading</li>
        <li>Save hours of manual tracking</li>
      </ul>
    </section>
  );
}

export function SocialProofSection() {
  return (
    <section className="py-20 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">Early members are joining</h2>
      <div className="mt-6 space-y-4 text-lg text-gray-600">
        <p>You&apos;re getting access at the founding member price.</p>
        <p>Built by an active Polymarket trader.</p>
        <p>Continuously improving with early users.</p>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section className="py-20 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">Founding Member Pricing</h2>
      <p className="mt-6 text-3xl font-bold text-gray-900">$29 / month</p>
      <ul className="mx-auto mt-6 max-w-sm list-disc space-y-3 pl-5 text-left text-lg text-gray-600">
        <li>Real-time whale alerts</li>
        <li>Track smart money wallets</li>
        <li>Early member pricing</li>
        <li>Direct founder support</li>
      </ul>
      <div className="mt-8">
        <PrimaryButton>Start tracking whales</PrimaryButton>
      </div>
      <p className="mt-6 text-sm text-gray-500">Cancel anytime. No commitment.</p>
    </section>
  );
}

export function UrgencySection() {
  return (
    <section className="py-20 text-center">
      <p className="text-lg text-gray-600">
        Founding member spots are limited.
        <br />
        Price will increase as more users join.
      </p>
    </section>
  );
}

export function FinalCTASection() {
  return (
    <section className="py-20 pb-32 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">
        Stop trading blind.
        <br />
        Start following whales.
      </h2>
      <div className="mt-8">
        <PrimaryButton>Get Whale Alerts — $29/mo</PrimaryButton>
      </div>
      <p className="mt-6 text-sm text-gray-500">Takes less than 30 seconds to join.</p>
    </section>
  );
}

export function StickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
      <div className="mx-auto max-w-md">
        <PrimaryButton>Start Whale Alerts — $29/mo</PrimaryButton>
      </div>
    </div>
  );
}

export default function PolymarketAlertsTlPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto max-w-md px-4">
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
