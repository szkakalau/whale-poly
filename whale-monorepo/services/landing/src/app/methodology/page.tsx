import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Methodology — SightWhale.com',
  description: 'How SightWhale.com collects data, scores wallets, and generates alerts for Polymarket trade flow.',
  alternates: { canonical: '/methodology' },
  openGraph: {
    title: 'Methodology — SightWhale.com',
    description: 'How SightWhale.com collects data, scores wallets, and generates alerts for Polymarket trade flow.',
    type: 'website',
    url: 'https://www.sightwhale.com/methodology',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function MethodologyPage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-12%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-10">
        <section className="space-y-4">
          <p className="text-xs font-bold text-cyan-400 tracking-[0.35em] uppercase">
            Methodology
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            How we turn trade flow into actionable alerts.
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-3xl">
            SightWhale.com tracks Polymarket trade activity, maps it back to wallets, and surfaces the
            most decision-relevant information. This page explains what we measure, what we do not
            measure, and the key limitations you should understand.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">Data sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div className="space-y-2">
              <p className="font-semibold text-white">Market activity</p>
              <ul className="space-y-2">
                <li>Polymarket market metadata (events, markets, outcomes)</li>
                <li>Trade flow (size, price, side, timestamp) when available</li>
                <li>Publicly available on-chain data for settlement and attribution</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-white">Wallet context</p>
              <ul className="space-y-2">
                <li>Historical activity and realized PnL where computable</li>
                <li>Aggregates by market, time window, and action type</li>
                <li>Optional display names (e.g., ENS or public aliases)</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            We do not collect private account data from Polymarket. We only use publicly observable
            information.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Signal selection</p>
            <p className="mt-3 text-sm text-gray-200 leading-relaxed">
              Alerts are triggered by a combination of trade size, wallet history, and the market
              context. We bias toward high-information moves.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Wallet scoring</p>
            <p className="mt-3 text-sm text-gray-200 leading-relaxed">
              Scores are based on measurable outcomes over time (e.g., realized PnL, consistency,
              drawdowns). The exact weighting is proprietary and may evolve.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Collections</p>
            <p className="mt-3 text-sm text-gray-200 leading-relaxed">
              Smart Collections group wallets by repeatable behaviors (e.g., high PnL, high score,
              specialized segments) to improve signal density.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">Limitations & interpretation</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              Prediction markets can be thin, reflexive, and headline-driven. A large trade does not
              necessarily mean “inside information”; it can also reflect hedging, liquidity
              provision, or portfolio rebalancing.
            </p>
            <p>
              Wallet performance metrics can be biased by survivorship, changing regimes, and
              incomplete data. Treat scores as directional context, not guarantees.
            </p>
            <p>
              When data fields are missing from upstream sources, we fall back to best-effort
              normalization to keep pages and alerts consistent.
            </p>
          </div>
          <div className="text-xs text-gray-500 leading-relaxed">
            Risk disclosure: this product is informational. It is not investment advice.
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

