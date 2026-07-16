import { Suspense } from 'react';
import Link from 'next/link';
import { HomeCtaLink } from '@/components/HomeCtaLink';
import HomeStickyCta from '@/components/HomeStickyCta';
import HeroAnalyzeInput from '@/components/HeroAnalyzeInput';
import { PRICING_PRO_MONTHLY } from '@/lib/pricing-plans';
import { PAIN_POINTS, HOW_IT_WORKS, MOATS, FAQ_ITEMS } from '@/lib/home-content';
import {
  ScorePerformanceSection, StarWhaleSection,
  StatsSection, HeroStat, HeroStatFallback, LivePreview,
} from '@/components/HomeDataComponents';
import LatestBlogPosts from '@/components/LatestBlogPosts';
import {
  ArrowRight, Search, Zap,
} from 'lucide-react';

/* ── Page ── */

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: a,
    },
  })),
};

export default function Home() {
  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      {/* JSON-LD structured data — FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      {/* ═══════════════════════════════════════════
          SECTION 1 — HERO (typography-first)
          ═══════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-16 sm:pb-20 hero-glow">
        <p className="eyebrow mb-6">Polymarket whale intelligence</p>

        <h1 className="text-balance mb-6">
          We track the top 1% of Polymarket whales.
          <br />
          They&apos;re right{' '}
          <Suspense fallback={<HeroStatFallback />}>
            <HeroStat />
          </Suspense>.
        </h1>

        <p className="text-base sm:text-lg text-muted max-w-xl leading-relaxed mb-8">
          Every signal — wins, losses, break-evens — published on a permanent public record.
          Because if we can&apos;t prove it works, you shouldn&apos;t pay for it.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <HomeCtaLink
            href="/pricing"
            placement="hero_primary"
            className="btn-primary px-8 min-h-[52px] text-base inline-flex items-center justify-center gap-2"
          >
            Get real-time signals
            <Zap className="w-4 h-4" aria-hidden />
          </HomeCtaLink>
          <HomeCtaLink
            href="/history"
            placement="hero_secondary"
            className="btn-secondary min-h-[52px]"
          >
            View audited history
            <ArrowRight className="w-4 h-4 ml-1.5 opacity-60" aria-hidden />
          </HomeCtaLink>
        </div>

        <div className="max-w-xl mt-6">
          <HeroAnalyzeInput />
        </div>

        <p className="mt-4 text-xs text-subtle">
          From ${PRICING_PRO_MONTHLY}/mo · Pro plan · Cancel anytime
        </p>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2 — TRACK RECORD
          ═══════════════════════════════════════════ */}
      <StatsSection />

      <Suspense fallback={null}>
        <ScorePerformanceSection />
      </Suspense>

      {/* SECTION 3 — THE PROBLEM */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32" aria-labelledby="problem-heading">
        <p className="eyebrow mb-3">Why you need this</p>
        <h2 id="problem-heading" className="text-balance mb-8">
          Polymarket moves fast. You&apos;re losing edge right now.
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {PAIN_POINTS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg bg-surface card-shadow card-shadow-accent transition-shadow px-6 py-6"
            >
              <Icon className="w-5 h-5 text-accent mb-4" aria-hidden />
              <h3 className="font-display text-base font-semibold text-foreground mb-2 leading-snug">
                {title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32" aria-labelledby="how-heading">
        <p className="eyebrow mb-3">How it works</p>
        <h2 id="how-heading" className="text-balance mb-10">
          From whale trade to your phone in three steps.
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ icon: Icon, title, description }, i) => (
            <div key={title} className="relative">
              <div className="flex items-center gap-4 mb-4">
                <span className="stat-number text-3xl font-semibold text-accent/20 tabular-nums select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="h-px flex-1 bg-border hidden sm:block" aria-hidden />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Icon className="w-5 h-5 text-accent shrink-0" aria-hidden />
                <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
              </div>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* /analyze bridge */}
        <div className="mt-10 rounded-lg bg-surface card-shadow px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-accent shrink-0" aria-hidden />
            <p className="text-sm text-muted leading-relaxed">
              <span className="font-semibold text-foreground">Prefer to hunt yourself?</span>{' '}
              Paste any Polymarket link or keyword into{' '}
              <Link href="/analyze" className="text-accent font-semibold hover:text-accent-hover transition-colors">
                /analyze
              </Link>{' '}
              and see what the whales are doing on any market, live.
            </p>
          </div>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover transition-colors shrink-0"
          >
            Open /analyze
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* SECTION 5 — THE MOAT */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32" aria-labelledby="moat-heading">
        <p className="eyebrow mb-3">Why SightWhale</p>
        <h2 id="moat-heading" className="text-balance mb-8">
          Three things no other signal service offers.
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {MOATS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg bg-surface card-shadow px-6 py-6"
            >
              <Icon className="w-5 h-5 text-accent mb-4" aria-hidden />
              <h3 className="font-display text-base font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <Suspense fallback={null}>
        <StarWhaleSection />
      </Suspense>

      {/* SECTION 6 — LIVE PREVIEW */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32" aria-labelledby="live-heading">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow mb-2">Live preview</p>
            <h2 id="live-heading" className="text-balance">See it in action</h2>
            <p className="text-sm text-muted mt-1.5 max-w-md">
              Three recent signals from the live feed, delayed by ~1 hour. Subscribers get
              real-time delivery to Telegram in ~30 seconds.
            </p>
          </div>
          <HomeCtaLink
            href="/pricing"
            placement="live_unlock"
            className="btn-primary inline-flex justify-center px-6 py-3 text-sm font-semibold shrink-0"
          >
            Unlock full feed
          </HomeCtaLink>
        </div>
        <Suspense
          fallback={
            <div className="h-48 rounded-lg bg-surface card-shadow animate-pulse" aria-hidden />
          }
        >
          <LivePreview />
        </Suspense>
      </section>

      {/* SECTION 6.5 — LATEST BLOG POSTS */}
      <Suspense fallback={null}>
        <LatestBlogPosts />
      </Suspense>

      {/* SECTION 7 — FAQ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32" aria-labelledby="faq-heading">
        <p className="eyebrow mb-3">Common questions</p>
        <h2 id="faq-heading" className="text-balance mb-8">
          Let&apos;s clear up the obvious ones.
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FAQ_ITEMS.map(({ q, a }) => (
            <div
              key={q}
              className="rounded-lg bg-surface card-shadow px-6 py-5"
            >
              <h3 className="text-sm font-semibold text-foreground mb-2">{q}</h3>
              <p className="text-sm text-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 8 — FINAL CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32 text-center" aria-labelledby="cta-heading">
        <h2 id="cta-heading" className="text-balance mb-4">
          Try your first month risk-free.
        </h2>
        <p className="text-sm sm:text-base text-muted max-w-lg mx-auto mb-8 leading-relaxed">
          Start with Pro at ${PRICING_PRO_MONTHLY}/mo. If the signals don&apos;t add value in your
          first month, email us for a full refund. No questions asked.
        </p>
        <HomeCtaLink
          href="/pricing"
          placement="closing"
          className="btn-primary inline-flex px-10 py-4 text-base font-semibold"
        >
          View plans & start
        </HomeCtaLink>
        <p className="mt-4 text-xs text-subtle">Secure Stripe checkout · Cancel anytime · Full refund first month</p>
      </section>

      <HomeStickyCta />
    </div>
  );
}
