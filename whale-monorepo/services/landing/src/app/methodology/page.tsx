import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

export const metadata: Metadata = {
  title: { absolute: 'Methodology — How SightWhale Identifies and Scores Whale Wallets' },
  description:
    'How SightWhale identifies top Polymarket whales, clusters wallets, and scores trades. Transparent methodology for our 0-100 Whale Score system.',
  openGraph: {
    title: 'Methodology — How SightWhale Identifies and Scores Whale Wallets',
    description:
      'Transparent methodology for SightWhale\'s Whale Score system: wallet identification, clustering, and trade scoring.',
    type: 'website',
    url: 'https://www.sightwhale.com/methodology',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale Methodology — Whale Score System',
    description: 'Transparent methodology for how we identify and score whale wallets.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: '/methodology',
  },
};

const methodologyJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      name: 'SightWhale Methodology',
      url: 'https://www.sightwhale.com/methodology',
      headline: 'How SightWhale Identifies and Scores Whale Wallets on Polymarket',
      description:
        'Transparent methodology for SightWhale\'s whale identification, wallet clustering, and Whale Score system.',
      datePublished: '2025-01-01',
      dateModified: '2026-07-18',
      author: {
        '@type': 'Person',
        name: 'SightWhale Team',
        url: 'https://www.sightwhale.com/about',
      },
      publisher: {
        '@type': 'Organization',
        '@id': 'https://www.sightwhale.com/#org',
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.sightwhale.com/' },
        { '@type': 'ListItem', position: 2, name: 'Methodology', item: 'https://www.sightwhale.com/methodology' },
      ],
    },
  ],
};

export default function MethodologyPage() {
  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(methodologyJsonLd) }}
      />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-28 sm:pt-36 pb-24 sm:pb-32">
        <BreadcrumbListScript items={[{ name: 'Methodology', url: '/methodology' }]} />

        <p className="eyebrow mb-4">Methodology</p>
        <h1 className="text-balance mb-4">
          How we identify and score whale wallets
        </h1>
        <p className="text-sm text-subtle mb-10 leading-relaxed">
          Last updated: <time dateTime="2026-07-18">July 18, 2026</time>
        </p>

        <div className="prose prose-muted max-w-none space-y-6 text-sm sm:text-base leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground font-display mb-3">
              1. Whale Identification
            </h2>
            <p>
              We define &ldquo;whales&rdquo; as the top 1% of Polymarket wallets ranked by
              calibrated ROI — not raw profit-and-loss. Raw PnL favors large wallets
              regardless of skill; calibrated ROI normalizes for capital deployed,
              rewarding consistent profitability over sheer size.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted">
              <li>Wallets are ranked by a composite of realized ROI, win rate (rolling 30/60/90-day), and risk-adjusted return.</li>
              <li>The top percentile by this composite metric enters our tracking universe.</li>
              <li>Wallets that drop below the threshold in consecutive windows are removed.</li>
              <li>Our tracking universe is recalculated daily. Statistics cited on the site reflect the most recent complete window.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
              2. Wallet Clustering
            </h2>
            <p>
              Approximately 40% of large Polymarket traders control 5+ wallets.
              Without clustering, one trader&apos;s $500K position split across 30 wallets
              appears as 30 independent small traders — systematically undercounting
              true position size and conviction.
            </p>
            <p>
              SightWhale clusters wallets by shared deposit addresses on Polygon:
              when multiple wallets receive funds from the same source address within
              a defined time window, they are grouped as a single trading entity.
              This is the same technique used by on-chain analytics firms like
              Nansen and Chainalysis for entity resolution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
              3. Whale Score (0-100)
            </h2>
            <p>
              Every trade receives a composite 0-100 score based on four weighted factors:
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-hover border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground">Factor</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground">Weight</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  <tr className="hover:bg-surface-hover">
                    <td className="px-4 py-2.5 text-foreground font-medium">Trader Win Rate</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">35%</td>
                    <td className="px-4 py-2.5 text-muted text-xs">Rolling 30/60/90-day windows; higher weight on recent performance</td>
                  </tr>
                  <tr className="hover:bg-surface-hover">
                    <td className="px-4 py-2.5 text-foreground font-medium">Trade Size vs. Market Depth</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">30%</td>
                    <td className="px-4 py-2.5 text-muted text-xs">Trade size normalized against 24h market volume; larger relative size = higher conviction signal</td>
                  </tr>
                  <tr className="hover:bg-surface-hover">
                    <td className="px-4 py-2.5 text-foreground font-medium">Market Context</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">20%</td>
                    <td className="px-4 py-2.5 text-muted text-xs">Directional bet vs. hedging vs. liquidity provision; directional bets weighted highest</td>
                  </tr>
                  <tr className="hover:bg-surface-hover">
                    <td className="px-4 py-2.5 text-foreground font-medium">Time Decay</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">15%</td>
                    <td className="px-4 py-2.5 text-muted text-xs">Recency bonus for signals delivered within minutes of on-chain confirmation</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-subtle">
              Higher scores correlate with higher win rates in backtests. Past performance does not guarantee future results.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
              4. Data Sources
            </h2>
            <p>
              All trade data is sourced from the Polymarket CLOB (Central Limit Order Book)
              on the Polygon blockchain. We ingest matched-order events via the Polymarket
              API and the Polygon RPC. Our data pipeline processes approximately 50,000-150,000
              trades per day across 500+ active markets.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
              5. Performance Metrics
            </h2>
            <p>
              All performance statistics cited on the site — including win rates, average ROI,
              and total PnL — are calculated from resolved markets only and reflect the
              complete public history available on the{' '}
              <Link href="/history" className="text-accent font-semibold hover:text-accent-hover transition-colors">History page</Link>.
              Key definitions:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted">
              <li><strong>Win Rate</strong>: Number of winning signals divided by total resolved signals. A signal &ldquo;wins&rdquo; if the realized or computed PnL is positive.</li>
              <li><strong>Average ROI</strong>: Mean return-on-investment across all resolved signals, expressed as a percentage of entry price.</li>
              <li><strong>Total PnL</strong>: Sum of all realized or computed profit-and-loss across resolved signals, in USD.</li>
              <li>Statistics are updated daily and reflect data through the end of the previous UTC day.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-display mt-10 mb-3">
              6. Limitations
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-muted">
              <li>Past performance does not guarantee future results.</li>
              <li>Whale tracking is a lagging signal — we detect trades after on-chain confirmation, which may trail the actual decision by minutes.</li>
              <li>Wallet clustering is probabilistic; no method can identify all related wallets with 100% accuracy.</li>
              <li>Content is informational only and does not constitute investment advice.</li>
            </ul>
          </section>

          <div className="pt-8 mt-8 border-t border-border">
            <Link
              href="/about"
              className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              ← About SightWhale
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
