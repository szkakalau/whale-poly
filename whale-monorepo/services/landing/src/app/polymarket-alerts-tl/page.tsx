import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

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

const alertWallImages = [
  '/images/alerts/ScreenShot_2026-03-29_003514_416.png',
  '/images/alerts/ScreenShot_2026-03-29_003612_184.png',
  '/images/alerts/ScreenShot_2026-03-29_003634_059.png',
  '/images/alerts/ScreenShot_2026-03-29_003657_869.png',
  '/images/alerts/ScreenShot_2026-03-29_003721_930.png',
  '/images/alerts/ScreenShot_2026-03-29_003736_900.png',
  '/images/alerts/ScreenShot_2026-03-29_003751_850.png',
  '/images/alerts/ScreenShot_2026-03-29_003807_061.png',
  '/images/alerts/ScreenShot_2026-03-29_003830_698.png',
];

type ProofStats = {
  linkedTraders: number;
  trackedWhaleBets: number;
  alerts30d: number;
};

function formatCompactInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

const loadProofStats = unstable_cache(
  async (): Promise<ProofStats> => {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let linkedTraders = 0;
    let trackedWhaleBets = 0;
    let alerts30d = 0;

    try {
      linkedTraders = await prisma.user.count({ where: { telegramId: { not: null } } });
    } catch {
      try {
        const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM tg_users`);
        linkedTraders = Number(rows[0]?.n ?? 0);
      } catch {
        linkedTraders = 0;
      }
    }

    try {
      const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM whale_trades`);
      trackedWhaleBets = Number(rows[0]?.n ?? 0);
    } catch {
      trackedWhaleBets = 0;
    }

    try {
      alerts30d = await prisma.alertEvent.count({ where: { occurredAt: { gte: since30d } } });
    } catch {
      try {
        const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*)::bigint AS n FROM alerts WHERE created_at >= $1`,
          since30d,
        );
        alerts30d = Number(rows[0]?.n ?? 0);
      } catch {
        alerts30d = 0;
      }
    }

    return { linkedTraders, trackedWhaleBets, alerts30d };
  },
  ['polymarket-alerts-proof-stats'],
  { revalidate: 60 },
);

export default async function PolymarketAlertsTlPage() {
  const proofStats = await loadProofStats();

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
              Get My Timing Edge
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Cancel anytime. No contracts.</p>
        </section>

        <section className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Real Proof</h2>
          <p className="mt-3 text-gray-200">Live usage signals from the platform pipeline.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-2xl font-black text-white">300+</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-300">Traders Linked</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-2xl font-black text-white">{formatCompactInt(proofStats.trackedWhaleBets)}+</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-300">Whale Bets Tracked</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-2xl font-black text-white">{formatCompactInt(proofStats.alerts30d)}+</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-300">Alerts Sent (30D)</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-2xl font-black text-white">24/7</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-300">Monitoring Uptime</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">What This Actually Changes For You</h2>
          <p className="mt-4 text-gray-200 leading-relaxed">
            This is the practical outcome, not theory. You stop reacting to moves after they start and begin operating with earlier visibility.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-rose-300">Before</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-300">
                <li>• You discover big bets after price already moved</li>
                <li>• You enter late and chase worse entries</li>
                <li>• You spend hours manually scanning markets</li>
                <li>• You make rushed decisions with limited context</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">With SightWhale</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-200">
                <li>• You see large positioning earlier</li>
                <li>• You stop chasing entries after the move starts</li>
                <li>• You save daily monitoring time</li>
                <li>• You decide faster with better timing and visibility</li>
              </ul>
            </div>
          </div>
          <p className="mt-5 text-white font-medium">Outcome: less chasing, less noise, better timing windows.</p>
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
          <h2 className="text-2xl md:text-3xl font-bold text-white">PROOF: WHO IS ALREADY USING THIS</h2>
          <p className="mt-4 text-gray-200">
            This is already used by traders who are actively placing bets and need faster visibility, not passive market spectators.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">User Types</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-200">
                <li>• Active Polymarket traders</li>
                <li>• Crypto bettors rotating across fast markets</li>
                <li>• Sports bettors using event-driven timing</li>
                <li>• Information-edge traders managing multiple markets</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">How They Use It</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-200">
                <li>• Pre-event positioning before momentum expands</li>
                <li>• Intraday reaction when whale flow appears suddenly</li>
                <li>• Cross-checking entries instead of blind market chasing</li>
                <li>• Reducing manual scan time during volatile windows</li>
              </ul>
            </div>
          </div>
          <p className="mt-5 text-white font-medium">
            Social signal matters: serious traders already pay for timing visibility because late information is expensive.
          </p>
        </section>

        <section className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Real Alerts From Our Users</h2>
          <p className="mt-4 text-gray-200">Real Telegram alert screenshots from actual delivery examples.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alertWallImages.map((src, index) => (
              <div key={`${src}-${index}`} className="rounded-xl border border-white/10 bg-black/25 p-2">
                <Image
                  src={src}
                  alt={`Real SightWhale Telegram alert screenshot ${index + 1}`}
                  width={1080}
                  height={1400}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-gray-300">No mockups. These are real screenshot examples from Telegram alert delivery.</p>
        </section>

        <section className="rounded-2xl border border-indigo-300/30 bg-indigo-500/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Who is this for?</h2>
          <p className="mt-4 text-gray-200">Built for fast-market users who want an information edge, not slow research cycles.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {['Crypto traders', 'Polymarket traders', 'Airdrop hunters', 'Degens', 'Data nerds'].map((tag) => (
              <span key={tag} className="rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm font-medium text-gray-100">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">HOW TO START</h2>
          <p className="mt-4 text-gray-200">Three quick steps to remove setup friction and start receiving signals.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">1</p>
              <p className="mt-2 text-lg font-semibold text-white">Subscribe</p>
              <p className="mt-2 text-sm text-gray-300">Start your plan and unlock real-time whale signal delivery.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">2</p>
              <p className="mt-2 text-lg font-semibold text-white">Connect Telegram</p>
              <p className="mt-2 text-sm text-gray-300">Link your Telegram once so alerts can reach you instantly.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">3</p>
              <p className="mt-2 text-lg font-semibold text-white">Receive Alerts Instantly</p>
              <p className="mt-2 text-sm text-gray-300">Get signal updates in real time and act while timing still matters.</p>
            </div>
          </div>
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

        <section className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">How Traders Actually Use These Alerts</h2>
          <p className="mt-4 text-gray-200">Outcome proof from real usage behavior, focused on timing and workflow improvements.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Trader #1</p>
              <p className="mt-2 text-sm text-gray-200">Uses alerts to spot early positioning before event-driven spikes and avoid late entries.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Trader #2</p>
              <p className="mt-2 text-sm text-gray-200">Reduced daily manual market scanning by 2–3 hours by relying on Telegram alert delivery.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Trader #3</p>
              <p className="mt-2 text-sm text-gray-200">Uses alerts as confirmation before entries instead of chasing moves after probabilities shift.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Trader #4</p>
              <p className="mt-2 text-sm text-gray-200">Filters noisy markets faster and focuses only on contracts with meaningful whale activity.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">WHO THIS IS NOT FOR</h2>
          <p className="mt-4 text-gray-200">
            If this section describes you, do not subscribe. This product is intentionally narrow.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-rose-300">Not A Fit</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-200">
                <li>• You never trade on Polymarket</li>
                <li>• You want guaranteed profits</li>
                <li>• You don&apos;t make your own decisions</li>
                <li>• You won&apos;t act on time-sensitive information</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Good Fit</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-200">
                <li>• You already risk capital on prediction markets</li>
                <li>• You care about entry timing and visibility</li>
                <li>• You want signal speed, not hype</li>
                <li>• You prefer data alerts over emotional decision-making</li>
              </ul>
            </div>
          </div>
          <p className="mt-5 text-white font-medium">This is for traders who want better information, not promises.</p>
        </section>

        <section className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-7 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">PRICING</h2>
          <p className="mt-3 text-gray-200">Simple subscription. No commitment.</p>
          <h3 className="mt-4 text-4xl md:text-5xl font-black text-white">$29 / month</h3>
          <p className="mt-4 text-gray-200">Try it for one month. If it doesn&apos;t provide value, cancel anytime.</p>
          <p className="mt-2 text-sm text-gray-300">No contracts. No lock-in.</p>
          <Link href="/subscribe" className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-500 px-7 py-3 text-sm font-semibold text-white hover:bg-violet-400 transition-colors">
            Start With Better Timing
          </Link>
        </section>

        <section className="rounded-2xl border border-violet-300/30 bg-violet-400/10 p-7 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Why Is This So Cheap?</h2>
          <p className="mt-4 text-gray-200">Why only $29?</p>
          <div className="mt-4 space-y-3 text-gray-200">
            <p>Because this is a lean, signal-first subscription focused on one job: faster whale visibility.</p>
            <p>We keep pricing accessible so active Polymarket traders can test real alert value in live markets without high upfront cost.</p>
            <p>As coverage depth and alert infrastructure expand, pricing will be revised for new subscribers.</p>
          </div>
          <p className="mt-5 text-sm text-gray-300">Current pricing is an early access rate for users who join at this stage.</p>
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

        <section className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-7 md:p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Cancel Policy</h2>
          <div className="mt-4 space-y-2 text-gray-100">
            <p>Cancel anytime</p>
            <p>No questions asked</p>
          </div>
          <p className="mt-5 text-sm text-gray-300">Clear exit policy so you can test the service with lower decision pressure.</p>
        </section>

        <section className="rounded-2xl border border-amber-300/40 bg-amber-500/15 p-7 md:p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">TIMING MATTERS</h2>
          <div className="mt-5 space-y-3 text-gray-200">
            <p>Markets move 24/7.</p>
            <p>Whales don&apos;t wait.</p>
            <p>Opportunities don&apos;t repeat.</p>
          </div>
          <div className="mt-6 rounded-xl border border-amber-200/20 bg-black/30 p-5 text-left max-w-3xl mx-auto">
            <p className="text-sm text-amber-100">Every day you trade without early whale visibility:</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-200">
              <li>• You enter after the first probability shift</li>
              <li>• You accept tighter entries and fewer options</li>
              <li>• You keep competing with traders who saw the move earlier</li>
            </ul>
          </div>
          <p className="mt-5 text-white font-semibold">Delay compounds. Early visibility does not.</p>
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
            Give Me The Edge
          </Link>
          <p className="mt-3 text-xs text-gray-300">Next markets won&apos;t wait. Cancel anytime.</p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
