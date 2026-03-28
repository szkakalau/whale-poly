import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Polymarket Whale Alerts - Information Edge for Traders',
  description:
    'SightWhale helps Polymarket traders track smart money in real time with Telegram alerts and actionable market context.',
  openGraph: {
    title: 'SightWhale – Polymarket Whale Alerts',
    description:
      'Track smart money behavior and large Polymarket bets in real time. Get instant alerts and increase your odds with an information advantage.',
    type: 'website',
    url: 'https://www.sightwhale.com/polymarket-alerts-tl',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale – Polymarket Whale Alerts',
    description:
      'Track smart money behavior and large Polymarket bets in real time. Get instant alerts and increase your odds with an information advantage.',
  },
  alternates: {
    canonical: '/polymarket-alerts-tl',
  },
};

const faqItems = [
  {
    q: 'Is this financial advice?',
    a: 'No. SightWhale provides market data and alerts only. You make your own decisions.',
  },
  {
    q: 'Can you guarantee profits?',
    a: 'No trading tool can guarantee profits. Our goal is to give you better information and timing.',
  },
  {
    q: 'Who is this for?',
    a: 'Anyone actively trading or betting on Polymarket.',
  },
  {
    q: 'Do I need experience?',
    a: 'Basic understanding of Polymarket is enough.',
  },
  {
    q: 'How are alerts delivered?',
    a: 'Instantly via Telegram.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel your subscription anytime.',
  },
];

export default function PolymarketAlertsTlPage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-12%] left-[-10%] w-[42%] h-[42%] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-14%] right-[-10%] w-[42%] h-[42%] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-32 pb-24 relative space-y-10">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 md:p-12">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-5">HERO</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white max-w-4xl">
            Stop Entering Polymarket After The Move Started.
          </h1>
          <p className="mt-6 text-lg text-gray-300 max-w-3xl">
            See whale-sized bets in real time and act with an information edge before most traders notice.
          </p>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-200">Track large Polymarket bets automatically</li>
            <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-200">Get instant Telegram alerts</li>
            <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-200">Stop missing early positioning</li>
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/subscribe"
              className="inline-flex items-center justify-center rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-400 transition-colors"
            >
              Get Real-Time Whale Alerts
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Cancel anytime. No contracts.</p>
        </section>

        <section className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">WHAT THIS MEANS IN PRACTICE</h2>
          <div className="mt-5 space-y-4 text-gray-300 leading-relaxed">
            <p>Most traders discover big bets after markets already moved.</p>
            <ul className="space-y-2">
              <li>• You stop discovering big bets after the move already started</li>
              <li>• You stop spending hours scanning markets manually</li>
              <li>• You start seeing where large capital is positioning early</li>
              <li>• You make faster decisions with more context</li>
            </ul>
            <p className="text-white font-medium">This is about speed and visibility.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">THE PROBLEM</h2>
          <div className="mt-5 space-y-4 text-gray-300 leading-relaxed">
            <p>Polymarket moves fast.</p>
            <p>Very fast.</p>
            <p>Large bets can shift probabilities within minutes. By the time most traders notice:</p>
            <ul className="space-y-2">
              <li>• The price already moved</li>
              <li>• The edge already shrank</li>
              <li>• The opportunity already changed</li>
            </ul>
            <p>Retail traders don&apos;t lose because they are wrong. They lose because they are late.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">THE OPPORTUNITY</h2>
          <div className="mt-5 space-y-4 text-gray-200 leading-relaxed">
            <p>In every financial market, large capital leaves signals.</p>
            <ul className="space-y-2">
              <li>• Stocks → institutional flow</li>
              <li>• Crypto → whale wallets</li>
              <li>• Prediction markets → large bets</li>
            </ul>
            <p>Tracking smart money behavior is one of the oldest trading edges.</p>
            <p className="text-white font-medium">SightWhale simply makes it visible.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">WHAT YOU GET</h2>
          <p className="mt-4 text-gray-300">Your subscription includes:</p>
          <ul className="mt-5 space-y-3 text-gray-200">
            <li className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">• Real-time whale bet alerts</li>
            <li className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">• Entry timing context</li>
            <li className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">• Market movement signals</li>
            <li className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">• Instant Telegram notifications</li>
            <li className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">• 24/7 automated monitoring</li>
            <li className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">• Time saved from manual tracking</li>
          </ul>
          <p className="mt-5 text-white font-medium">You focus on decisions. We monitor the markets.</p>
        </section>

        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">WHO IS ALREADY USING THIS</h2>
          <p className="mt-4 text-gray-300">SightWhale is built for:</p>
          <ul className="mt-5 space-y-2 text-gray-200">
            <li>• Active Polymarket traders</li>
            <li>• Crypto bettors</li>
            <li>• Sports betting users</li>
            <li>• Information-edge focused traders</li>
            <li>• People who already risk capital on prediction markets</li>
          </ul>
          <p className="mt-5 text-white font-medium">You don&apos;t need to trade more. You just need better timing and visibility.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">HOW IT WORKS</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-cyan-300 uppercase tracking-[0.2em]">Step 1 — We monitor markets 24/7</div>
              <p className="mt-2 text-sm text-gray-300">Our system continuously tracks large bets across Polymarket.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-cyan-300 uppercase tracking-[0.2em]">Step 2 — We detect unusual activity</div>
              <p className="mt-2 text-sm text-gray-300">When whale-sized positions appear, they are flagged instantly.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-cyan-300 uppercase tracking-[0.2em]">Step 3 — You receive alerts immediately</div>
              <p className="mt-2 text-sm text-gray-300">Signals are delivered directly to Telegram in real time.</p>
            </div>
          </div>
          <p className="mt-5 text-white font-medium">No dashboards. No complexity. Just alerts.</p>
        </section>

        <section className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">WHO THIS IS NOT FOR</h2>
          <p className="mt-4 text-gray-300">This is NOT for you if:</p>
          <ul className="mt-4 space-y-2 text-gray-200">
            <li>• You never trade on Polymarket</li>
            <li>• You are looking for guaranteed profits</li>
            <li>• You don&apos;t want to make your own decisions</li>
          </ul>
          <p className="mt-5 text-white font-medium">This is for traders who want better information.</p>
        </section>

        <section className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-7 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">PRICING</h2>
          <p className="mt-3 text-gray-200">Simple subscription. No commitment.</p>
          <h3 className="mt-4 text-4xl md:text-5xl font-black text-white">$29 / month</h3>
          <p className="mt-4 text-gray-200">Try it for one month. If it doesn&apos;t provide value, cancel anytime.</p>
          <p className="mt-2 text-sm text-gray-300">No contracts. No lock-in.</p>
          <Link href="/subscribe" className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-500 px-7 py-3 text-sm font-semibold text-white hover:bg-violet-400 transition-colors">
            Start Seeing Whale Bets
          </Link>
        </section>

        <section className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-7 md:p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">STRONG RISK REVERSAL</h2>
          <p className="mt-4 text-gray-200">Try it for a month.</p>
          <p className="mt-2 text-gray-200">Leave anytime.</p>
          <p className="mt-2 text-gray-200">No commitment.</p>
          <p className="mt-5 text-white font-medium">
            Test it in live markets, decide from your own experience, and keep it only if it improves your timing.
          </p>
        </section>

        <section className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-7 md:p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">TIMING MATTERS</h2>
          <div className="mt-5 space-y-3 text-gray-200">
            <p>Markets move 24/7.</p>
            <p>Whales don&apos;t wait.</p>
            <p>Opportunities don&apos;t repeat.</p>
          </div>
          <p className="mt-5 text-white font-medium">The earlier you see the move, the more options you have.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">FAQ</h2>
          <div className="mt-6 space-y-4">
            {faqItems.map((item) => (
              <div key={item.q} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <h3 className="text-white font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/15 via-violet-500/15 to-transparent p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white">Start Seeing What Large Traders Are Doing.</h2>
          <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
            Give yourself an information edge today.
          </p>
          <Link
            href="/subscribe"
            className="mt-7 inline-flex items-center justify-center rounded-xl bg-cyan-400 px-8 py-3 text-sm font-bold text-black hover:bg-cyan-300 transition-colors"
          >
            Get Real-Time Whale Alerts
          </Link>
          <p className="mt-3 text-xs text-gray-300">Cancel anytime.</p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
