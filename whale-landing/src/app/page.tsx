const CTA_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || "#pricing";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ v?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const variant = typeof sp?.v === "string" ? sp!.v : "a";
  const isB = variant === "b";
  const pageBgClass = isB
    ? "min-h-screen bg-gradient-to-b from-indigo-50 to-white text-zinc-900"
    : "min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900";
  const cardClass = isB ? "card-b" : "card";
  const primaryBtnClass = isB ? "btn-primary-b" : "btn-primary";
  const secondaryBtnClass = "btn-secondary";
  return (
    <div className={pageBgClass}>
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="font-semibold tracking-tight">Polymarket Whale Intelligence</div>
          <a href={CTA_URL} className={"inline-flex items-center px-5 py-2 text-sm font-medium rounded-full " + (isB ? "btn-primary-b" : "btn-primary") }>
            Get Whale Alerts →
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* HERO SECTION */}
        <section className="py-20 sm:py-28">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Follow the Smart Money. Not the Noise.</h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-600">
            Real-time intelligence on whale activity in Polymarket. We track what large, historically profitable players are <em>actually betting</em> — so you don’t have to guess.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a href={CTA_URL} className={"inline-flex items-center rounded-full px-6 py-3 text-base font-medium shadow " + primaryBtnClass}>
              Get Whale Alerts →
            </a>
            <a href="#sample-signals" className={"inline-flex items-center rounded-full px-6 py-3 text-base font-medium " + secondaryBtnClass}>
              View Sample Signals →
            </a>
            <a href="/backtesting" className={"inline-flex items-center rounded-full px-6 py-3 text-base font-medium " + secondaryBtnClass}>
              View Backtesting Results →
            </a>
            <a href="/conviction" className={"inline-flex items-center rounded-full px-6 py-3 text-base font-medium " + secondaryBtnClass}>
              View Conviction Case Studies →
            </a>
          </div>
        </section>

        {/* SOCIAL PROOF / TRUST PRIMER */}
        <section className="py-16 border-t border-zinc-200">
          <blockquote className="text-xl">“We don’t predict outcomes. We track capital.”</blockquote>
          <ul className="mt-6 space-y-2 text-zinc-700">
            <li>Built on real on-chain & orderbook data</li>
            <li>No anonymous tips, no hype calls</li>
            <li>Every signal is verifiable & reviewable</li>
          </ul>
        </section>

        {/* THE PROBLEM */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">Prediction markets are hard — not because of information, but because of <em>noise</em>.</h2>
          <ul className="mt-4 space-y-2 text-zinc-700">
            <li>Headlines move faster than facts</li>
            <li>Retail sentiment is loud and misleading</li>
            <li>By the time a narrative is obvious, price already moved</li>
          </ul>
          <p className="mt-4 text-zinc-700 font-medium">Meanwhile, smart money acts quietly — early, consistently, and with size.</p>
        </section>

        {/* THE SOLUTION */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">We surface what matters most:</h2>
          <h3 className="mt-2 text-3xl font-bold">Where real money is going.</h3>
          <p className="mt-4 text-zinc-700">Polymarket Whale Intelligence monitors:</p>
          <ul className="mt-2 space-y-2 text-zinc-700">
            <li>Large trades that move markets</li>
            <li>Addresses with strong historical accuracy</li>
            <li>Repeated accumulation patterns</li>
            <li>Capital flows before major price moves</li>
          </ul>
          <p className="mt-4 text-zinc-700">You see <em>who</em> is betting, <em>how much</em>, <em>when</em>, and <em>with what conviction</em>.</p>
        </section>

        {/* WHAT YOU GET — Whale Alerts */}
        <section id="sample-signals" className="py-16 border-t border-zinc-200">
          <h2 className="section-title">🐋 Whale Alerts</h2>
          <p className="mt-4 text-zinc-700">Real-time notifications when unusually large or aggressive trades hit the market.</p>
          <div className={cardClass + " mt-6"}>
            <p className="text-sm text-zinc-700">Example:</p>
            <pre className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6">
{`🐋 WHALE ALERT

Market: US Election – Trump Wins
Outcome: YES
Action: BUY

Size: $182,400
Avg Price: 0.41
Trades: 5
Time: 12 minutes ago

Whale Score: 7.8 / 10`}
            </pre>
          </div>
        </section>

        {/* WHAT YOU GET — Smart Money Watchlist */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">🧠 Smart Money Watchlist</h2>
          <p className="mt-4 text-zinc-700">We track addresses that consistently outperform.</p>
          <ul className="mt-2 space-y-2 text-zinc-700">
            <li>Total capital deployed</li>
            <li>Historical win rate (resolved markets)</li>
            <li>Preferred market types</li>
            <li>Current active positions</li>
          </ul>
          <p className="mt-4 text-zinc-700">Follow <em>who’s worth following</em>.</p>
        </section>

        {/* WHAT YOU GET — Conviction Signals (Elite) */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">🔥 Conviction Signals (Elite)</h2>
          <ul className="mt-4 space-y-2 text-zinc-700">
            <li>Multiple smart money addresses align</li>
            <li>Capital size is significant</li>
            <li>Positions are held over time</li>
          </ul>
          <p className="mt-4 text-zinc-700">These are not one-off trades — they reflect <strong>strong belief</strong>.</p>
        </section>

        {/* WHAT YOU GET — Market Heatmap */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">📊 Market Heatmap</h2>
          <ul className="mt-4 space-y-2 text-zinc-700">
            <li>Whale volume vs total volume</li>
            <li>Net capital inflow</li>
            <li>Momentum shifts</li>
          </ul>
          <p className="mt-4 text-zinc-700">Perfect for research and market discovery.</p>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">How It Works</h2>
          <ol className="mt-6 grid sm:grid-cols-2 gap-6">
            <li className={cardClass}><h4 className="font-semibold">1. We ingest real-time Polymarket trade & orderbook data</h4></li>
            <li className={cardClass}><h4 className="font-semibold">2. Identify abnormal capital movements</h4></li>
            <li className={cardClass}><h4 className="font-semibold">3. Score each event using historical accuracy, timing & impact</h4></li>
            <li className={cardClass}><h4 className="font-semibold">4. Deliver signals via dashboard, Telegram & email</h4></li>
          </ol>
          <p className="mt-4 text-zinc-700">Every signal is logged. Every score is auditable.</p>
        </section>

        {/* WHY WE’RE DIFFERENT */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">Why We’re Different</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2">Others</th>
                  <th className="text-left p-2">Us</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr><td className="p-2">Predict outcomes</td><td className="p-2">Track behavior</td></tr>
                <tr><td className="p-2">Anonymous tips</td><td className="p-2">On-chain evidence</td></tr>
                <tr><td className="p-2">Black-box calls</td><td className="p-2">Explainable signals</td></tr>
                <tr><td className="p-2">Cherry-picked wins</td><td className="p-2">Full history & stats</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-16 border-t border-zinc-200">
          <h2 className="section-title">Pricing</h2>
          <div className="mt-8 grid sm:grid-cols-3 gap-6">
            <div className={cardClass}>
              <h3 className="text-xl font-semibold">Free</h3>
              <ul className="mt-4 space-y-2 text-zinc-700">
                <li>Delayed whale alerts</li>
                <li>Market heatmap (limited)</li>
                <li>Sample signal history</li>
              </ul>
              <a href={CTA_URL} className={"mt-6 inline-flex items-center rounded-full px-5 py-2 text-sm font-medium " + secondaryBtnClass}>
                Get started free
              </a>
            </div>
            <div className={cardClass}>
              <h3 className="text-xl font-semibold">Pro — $39 / month</h3>
              <ul className="mt-4 space-y-2 text-zinc-700">
                <li>Real-time whale alerts</li>
                <li>Address profiles</li>
                <li>Full market heatmap</li>
                <li>30-day history</li>
              </ul>
              <a href={CTA_URL} className={"mt-6 inline-flex items-center rounded-full px-5 py-2 text-sm font-medium " + primaryBtnClass}>
                Start Pro
              </a>
            </div>
            <div className={cardClass}>
              <h3 className="text-xl font-semibold">Elite — $129 / month</h3>
              <ul className="mt-4 space-y-2 text-zinc-700">
                <li>Conviction Signals</li>
                <li>Smart Money Watchlist</li>
                <li>Historical win rates & ROI</li>
                <li>Priority alerts</li>
              </ul>
              <a href={CTA_URL} className={"mt-6 inline-flex items-center rounded-full px-5 py-2 text-sm font-medium " + primaryBtnClass}>
                Go Elite
              </a>
            </div>
          </div>
        </section>

        {/* WHO THIS IS FOR */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">Who This Is For</h2>
          <ul className="mt-4 grid sm:grid-cols-2 gap-3 text-zinc-700">
            <li>✅ Active Polymarket traders</li>
            <li>✅ Researchers & analysts</li>
            <li>✅ Crypto-native users</li>
            <li>❌ Gambling-style users</li>
            <li>❌ “Guaranteed win” seekers</li>
          </ul>
          <p className="mt-4 text-zinc-700">We focus on <strong>information advantage</strong>, not promises.</p>
        </section>

        {/* FAQ */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="section-title">FAQ</h2>
          <div className="mt-6 grid sm:grid-cols-2 gap-6">
            <div>
              <p className="font-medium">Is this financial advice?</p>
              <p className="text-zinc-700">No. This is informational intelligence based on public market data.</p>
            </div>
            <div>
              <p className="font-medium">Do you place trades for me?</p>
              <p className="text-zinc-700">No. We do not execute or suggest specific trades.</p>
            </div>
            <div>
              <p className="font-medium">Can I verify the data?</p>
              <p className="text-zinc-700">Yes. All alerts are based on verifiable market activity.</p>
            </div>
            <div>
              <p className="font-medium">Does smart money always win?</p>
              <p className="text-zinc-700">No. But historically, some participants perform significantly better than average — we track them transparently.</p>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-16 border-t border-zinc-200">
          <h2 className="text-2xl font-semibold">Stop guessing.</h2>
          <h3 className="mt-2 text-xl">Start tracking real capital.</h3>
          <a href={CTA_URL} className={"mt-6 inline-flex items-center rounded-full px-6 py-3 text-base font-medium " + primaryBtnClass}>
            Join Polymarket Whale Intelligence
          </a>
          <p className="mt-4 text-zinc-700">Data over drama. Signals over noise.</p>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-zinc-200 text-sm text-zinc-700">
          <div className="flex flex-wrap gap-3">
            <a href="#" className="hover:underline">Terms of Service</a>
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Contact</a>
          </div>
          <p className="mt-4">© Polymarket Whale Intelligence</p>
        </footer>
      </main>
    </div>
  );
}
