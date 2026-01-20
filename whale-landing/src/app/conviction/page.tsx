import Link from 'next/link';

export default function ConvictionPage() {
  const primaryBtnClass = "bg-black text-white hover:bg-zinc-800";
  const secondaryBtnClass = "border border-zinc-300 hover:bg-zinc-100";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* INTRO */}
      <section>
        <h1 className="text-3xl font-semibold">Conviction Signal Case Studies</h1>
        <p className="mt-4 text-zinc-700">Elite Signal Examples (Public Preview)</p>
        <blockquote className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-zinc-700">
          Below are realistic historical-style examples of Conviction Signals. They demonstrate structure, transparency, and post-event review — not promises.
        </blockquote>
      </section>

      {/* CASE 1 */}
      <section className="py-12 border-t border-zinc-200">
        <h2 className="text-2xl font-semibold">Case 1 — Political Market</h2>
        <h3 className="mt-4 text-xl">🔥 Conviction Signal</h3>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Market: US Election – Trump Wins</li>
          <li>Outcome: YES</li>
          <li>Conviction Score: 8.8 / 10</li>
          <li>Supporting Addresses: 3</li>
          <li>Total Capital: ~$640,000</li>
          <li>Entry Range: 0.38 – 0.41</li>
          <li>Holding Duration: 6 days</li>
        </ul>
        <h4 className="mt-4 font-medium">Context</h4>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Multiple high-accuracy addresses accumulated early</li>
          <li>No hedging behavior detected</li>
          <li>Buying occurred before major narrative shift</li>
        </ul>
        <h4 className="mt-4 font-medium">Result (Post-Resolution)</h4>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Price peak: 0.55</li>
          <li>Max favorable move: +34%</li>
          <li>Signal archived after exit</li>
        </ul>
      </section>

      {/* CASE 2 */}
      <section className="py-12 border-t border-zinc-200">
        <h2 className="text-2xl font-semibold">Case 2 — Crypto / Macro Market</h2>
        <h3 className="mt-4 text-xl">🔥 Conviction Signal</h3>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Market: BTC ETF Approval by Jan 31</li>
          <li>Outcome: YES</li>
          <li>Conviction Score: 9.1 / 10</li>
          <li>Supporting Addresses: 4</li>
          <li>Total Capital: ~$1.12M</li>
          <li>Entry Range: 0.52 – 0.56</li>
          <li>Holding Duration: 3 days</li>
        </ul>
        <h4 className="mt-4 font-medium">Context</h4>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Rapid whale accumulation over short window</li>
          <li>Strong alignment across independent addresses</li>
        </ul>
        <h4 className="mt-4 font-medium">Result</h4>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Price moved to 0.68 within 48h</li>
          <li>Peak move: +26%</li>
          <li>Limited drawdown observed</li>
        </ul>
      </section>

      {/* CASE 3 */}
      <section className="py-12 border-t border-zinc-200">
        <h2 className="text-2xl font-semibold">Case 3 — Geopolitical Market</h2>
        <h3 className="mt-4 text-xl">🔥 Conviction Signal</h3>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Market: Middle East Ceasefire by Q2</li>
          <li>Outcome: YES</li>
          <li>Conviction Score: 8.3 / 10</li>
          <li>Supporting Addresses: 2</li>
          <li>Total Capital: ~$410,000</li>
          <li>Entry Range: 0.61 – 0.63</li>
          <li>Holding Duration: 5 days</li>
        </ul>
        <h4 className="mt-4 font-medium">Context</h4>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Gradual accumulation</li>
          <li>No panic exits during volatility spikes</li>
        </ul>
        <h4 className="mt-4 font-medium">Result</h4>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Price range expanded to 0.71</li>
          <li>Signal resolved without adverse swing</li>
        </ul>
      </section>

      {/* TELEGRAM SAMPLE FEED */}
      <section className="py-12 border-t border-zinc-200">
        <h2 className="text-2xl font-semibold">Telegram Sample Feed</h2>
        <p className="mt-2 text-zinc-700">7-Day Historical Preview</p>
        <blockquote className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-zinc-700">
          This is an example feed showing how Whale Intelligence appears in real usage.
        </blockquote>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-medium">Day 1</h3>
            <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">{`🐋 WHALE ALERT
Market: Trump Wins Election
Action: BUY YES
Size: $184,000 @ 0.41
Whale Score: 7.7`}</pre>
          </div>
          <div>
            <h3 className="font-medium">Day 2</h3>
            <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">{`🐋 WHALE ACCUMULATION DETECTED
Market: BTC ETF Approval
Total Size (6h): $296,000
Whale Score: 8.2`}</pre>
          </div>
          <div>
            <h3 className="font-medium">Day 3</h3>
            <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">{`📊 WHALE FLOW UPDATE
Market: Middle East Ceasefire
Whale / Total Volume: 36%
Net Flow: +$210K`}</pre>
          </div>
          <div>
            <h3 className="font-medium">Day 4</h3>
            <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">{`🧠 SMART MONEY ACTIVITY
Address: 0xA9…F32
Historical Win Rate: 71%
New Position: $92K`}</pre>
          </div>
          <div>
            <h3 className="font-medium">Day 5</h3>
            <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">{`🔥 CONVICTION SIGNAL
Market: BTC ETF Approval
Conviction Score: 9.1`}</pre>
          </div>
          <div>
            <h3 className="font-medium">Day 6</h3>
            <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">{`📈 SIGNAL REVIEW
BTC ETF Approval
Alert Price: 0.54 → 0.66 (+22%)`}</pre>
          </div>
          <div>
            <h3 className="font-medium">Day 7</h3>
            <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">{`🐋 WHALE ALERT
Market: US Election – Biden Wins
Action: SELL NO
Size: $158,000
Whale Score: 7.4`}</pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 border-t border-zinc-200">
        <h2 className="text-2xl font-semibold">How This Is Used</h2>
        <ul className="mt-2 space-y-2 text-zinc-700 list-disc pl-5">
          <li>Public preview (website / pinned Telegram)</li>
          <li>Onboarding for new subscribers</li>
          <li>Proof of consistency & transparency</li>
        </ul>
        <p className="mt-4 text-zinc-700">Full real-time feed is available to subscribers.</p>
        <div className="mt-6 flex gap-4">
          <Link href="/" className={"inline-flex items-center rounded-full px-6 py-3 text-base font-medium shadow " + primaryBtnClass}>
            Get Real-Time Whale Alerts →
          </Link>
          <Link href="/backtesting" className={"inline-flex items-center rounded-full px-6 py-3 text-base font-medium " + secondaryBtnClass}>
            View Backtesting Results →
          </Link>
        </div>
      </section>
    </main>
  );
}