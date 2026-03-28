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

const heroBenefits = [
  'Track whale-sized bets across Polymarket in real time',
  'See where smart money is positioning before most retail notices',
  'Get instant Telegram alerts so you can act with better timing',
];

const deliverables = [
  'Real-time whale alerts on large Polymarket bets',
  'Entry timing signals while moves are still actionable',
  'Market context to understand what the signal is about',
  'Telegram notifications delivered instantly',
  'Time savings from not manually monitoring markets all day',
];

const credibilityPoints = [
  'Data-driven alerting focused on large, relevant market activity',
  'Continuous tracking across top Polymarket markets',
  'Signal logic built to detect unusual size and smart money behavior',
  'Built for serious traders who value information edge over noise',
];

const faqItems = [
  {
    q: 'Is this financial advice?',
    a: 'No. SightWhale provides market data and alerts, not financial advice.',
  },
  {
    q: 'Can you guarantee profits?',
    a: 'No. There are no guaranteed profits in prediction markets. SightWhale is designed to provide an information advantage, not certainty.',
  },
  {
    q: 'Who is this for?',
    a: 'Prediction market traders, crypto users, and sports betting users who want to track smart money behavior and improve decision timing.',
  },
  {
    q: 'Do I need experience?',
    a: 'No. New users can follow clear alerts, while experienced traders can integrate signals into their existing process.',
  },
  {
    q: 'How are alerts delivered?',
    a: 'Alerts are delivered through Telegram for immediate access.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Your subscription is month-to-month and can be canceled anytime.',
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
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-5">SightWhale – Polymarket Whale Alerts</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white max-w-4xl">
            Stop Trading Polymarket Blind. Follow Smart Money in Real Time.
          </h1>
          <p className="mt-6 text-lg text-gray-300 max-w-3xl">
            Track large bets the moment they hit, understand the market context, and act earlier with an information advantage instead of reacting late.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {heroBenefits.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-200"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/subscribe"
              className="inline-flex items-center justify-center rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-400 transition-colors"
            >
              Get Whale Alerts for $29/month
            </Link>
            <Link
              href="https://t.me/sightwhale_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-gray-100 hover:bg-white/10 transition-colors"
            >
              View Telegram Delivery
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Cancel anytime. No long-term commitment.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Markets move fast. Most retail arrives late.</h2>
          <div className="mt-5 space-y-4 text-gray-300 leading-relaxed">
            <p>Polymarket moves quickly. Whales often move first. Most retail sees the move after price has already shifted.</p>
            <p>You can spend hours doing manual research and still miss the bets that matter most. Entry timing suffers. Information edge disappears.</p>
            <p>If you have ever lost because you entered too late, you are not alone. The core problem is not effort. It is visibility and speed.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">The opportunity is simple: follow smart money flow.</h2>
          <div className="mt-5 space-y-4 text-gray-200 leading-relaxed">
            <p>Large capital often positions earlier than the crowd. Tracking that behavior can provide a practical information advantage.</p>
            <p>Across trading markets, following meaningful capital flow is a common strategy because money leaves signals.</p>
            <p>SightWhale is built to surface those signals quickly so you can increase your odds with better timing and better context.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">What You Get</h2>
          <ul className="mt-5 space-y-3">
            {deliverables.map((item) => (
              <li key={item} className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-gray-200">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Proof / Credibility</h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {credibilityPoints.map((item) => (
              <li key={item} className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-gray-200">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-gray-400">
            No guaranteed returns. No exaggerated claims. Just faster access to relevant market information.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">How It Works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-cyan-300 uppercase tracking-[0.2em]">Step 1</div>
              <p className="mt-2 text-white font-semibold">We monitor markets 24/7</p>
              <p className="mt-2 text-sm text-gray-400">Continuous monitoring of Polymarket activity and whale-sized capital moves.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-cyan-300 uppercase tracking-[0.2em]">Step 2</div>
              <p className="mt-2 text-white font-semibold">We detect unusual large bets</p>
              <p className="mt-2 text-sm text-gray-400">Signal logic identifies meaningful smart money behavior with market context.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-cyan-300 uppercase tracking-[0.2em]">Step 3</div>
              <p className="mt-2 text-white font-semibold">You get instant Telegram alerts</p>
              <p className="mt-2 text-sm text-gray-400">Use alerts to evaluate opportunities and make faster, better-timed decisions.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-7 md:p-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white">$29/month</h2>
          <p className="mt-3 text-gray-200">Cancel anytime. No long-term commitment.</p>
          <p className="mt-2 text-sm text-gray-300">Low-friction pricing for traders who want a consistent information edge.</p>
          <Link
            href="/subscribe"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-500 px-7 py-3 text-sm font-semibold text-white hover:bg-violet-400 transition-colors"
          >
            Start Subscription
          </Link>
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
          <h2 className="text-3xl md:text-5xl font-bold text-white">Get the edge before the market catches up.</h2>
          <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
            Every market cycle has traders who react and traders who move early. Stay on the early side with real-time smart money visibility.
          </p>
          <Link
            href="/subscribe"
            className="mt-7 inline-flex items-center justify-center rounded-xl bg-cyan-400 px-8 py-3 text-sm font-bold text-black hover:bg-cyan-300 transition-colors"
          >
            Subscribe Now — $29/month
          </Link>
          <p className="mt-3 text-xs text-gray-300">High-conviction bets move fast. Delayed information costs entries.</p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
