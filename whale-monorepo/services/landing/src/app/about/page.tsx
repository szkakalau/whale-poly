import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';
import { ShieldCheck, TrendingUp, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: { absolute: 'About SightWhale — Polymarket Whale Intelligence Platform' },
  description:
    'Learn about the team and methodology behind SightWhale, the Polymarket whale intelligence platform. Track the top 1% most profitable wallets with real-time Telegram alerts.',
  openGraph: {
    title: 'About SightWhale — Polymarket Whale Intelligence Platform',
    description:
      'Learn about the team and methodology behind SightWhale, the Polymarket whale intelligence platform.',
    type: 'website',
    url: 'https://www.sightwhale.com/about',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About SightWhale — Polymarket Whale Intelligence',
    description: 'Learn about the team and methodology behind SightWhale.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: '/about',
  },
};

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      name: 'About SightWhale',
      url: 'https://www.sightwhale.com/about',
      description:
        'SightWhale is a Polymarket whale intelligence platform that tracks the top 1% most profitable wallets.',
      about: {
        '@type': 'Organization',
        '@id': 'https://www.sightwhale.com/#org',
      },
      dateModified: '2026-07-18',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.sightwhale.com/' },
        { '@type': 'ListItem', position: 2, name: 'About', item: 'https://www.sightwhale.com/about' },
      ],
    },
  ],
};

export default function AboutPage() {
  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-28 sm:pt-36 pb-24 sm:pb-32">
        <BreadcrumbListScript items={[{ name: 'About', url: '/about' }]} />

        <p className="eyebrow mb-4">About</p>
        <h1 className="text-balance mb-6">
          We track the smartest money on prediction markets.
        </h1>

        <div className="prose prose-muted max-w-none space-y-6 text-sm sm:text-base leading-relaxed">
          <p>
            SightWhale was built to solve a simple problem: Polymarket has hundreds of active
            markets, and the most profitable traders move silently across dozens of wallets.
            Without tooling, following smart money is impossible.
          </p>

          <blockquote className="border-l-2 border-accent/30 pl-4 italic text-muted">
            &ldquo;Polymarket shows you what happened. SightWhale tells you who made it happen,
            how much they bet, and whether they&apos;ve been right before.&rdquo;
          </blockquote>

          <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
            What we do
          </h2>
          <p>
            We continuously monitor every trade from the top 1% most profitable Polymarket wallets.
            Our engine scores every signal on a 0-100 composite scale — factoring in trader
            win rate, ROI, trade size relative to market depth, and market context — and delivers
            high-conviction alerts via Telegram in ~30 seconds from on-chain confirmation.
          </p>

          <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
            Why it matters
          </h2>
          <p>
            Prediction markets are the most efficient mechanism for aggregating information.
            The largest, most consistently profitable participants — &ldquo;whales&rdquo; —
            consistently move markets before public information catches up. By tracking their
            activity, our subscribers gain an information edge that raw market data alone
            cannot provide.
          </p>

          <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
            Our principles
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            {[
              {
                icon: TrendingUp,
                title: 'Auditable forever',
                desc: 'Every signal — every win, every loss — stays on the public record. No cherry-picking, no deleted rows.',
              },
              {
                icon: ShieldCheck,
                title: 'Aligned incentives',
                desc: 'Full refund in your first month if the product does not meet expectations. We only win if you win.',
              },
              {
                icon: Zap,
                title: 'Push, don\'t pull',
                desc: 'Signals reach your phone in ~30 seconds via Telegram. No dashboard to refresh.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-lg bg-surface card-shadow px-5 py-5">
                <Icon className="w-5 h-5 text-accent mb-3" aria-hidden />
                <h3 className="font-display text-sm font-semibold text-foreground mb-1.5">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
            Contact
          </h2>
          <p>
            For questions, feedback, or support:{' '}
            <a href="mailto:castro.liu@me.com" className="text-accent font-semibold hover:text-accent-hover transition-colors underline decoration-accent/30 underline-offset-4">
              castro.liu@me.com
            </a>
          </p>
          <p>
            Follow us on{' '}
            <a href="https://twitter.com/SightWhale" target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:text-accent-hover transition-colors underline decoration-accent/30 underline-offset-4">
              X/Twitter @SightWhale
            </a>
          </p>
          <p className="text-xs text-subtle mt-2">
            We respond to all inquiries within 24 hours.
          </p>

          <div className="pt-8 mt-8 border-t border-border">
            <Link
              href="/methodology"
              className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              Read our full methodology →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
