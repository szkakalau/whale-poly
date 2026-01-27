import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conviction Signals - Whale Intelligence',
  description: 'Case studies showing how conviction signals are built and reviewed with transparent context.',
  openGraph: {
    title: 'Conviction Signals - Whale Intelligence',
    description: 'Case studies showing how conviction signals are built and reviewed with transparent context.',
    type: 'website',
    url: 'https://sightwhale.com/conviction',
    images: [
      {
        url: '/images/whale-alert-biden.svg',
        width: 1200,
        height: 630,
        alt: 'Conviction Signals'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Conviction Signals - Whale Intelligence',
    description: 'Case studies showing how conviction signals are built and reviewed with transparent context.',
    images: ['/images/whale-alert-biden.svg']
  },
  alternates: {
    canonical: '/conviction',
  },
};

export default function ConvictionPage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px]"></div>
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 py-32 relative">
        {/* INTRO */}
        <section className="mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Conviction Signal Case Studies
          </h1>
          <p className="text-xl text-violet-300 font-medium mb-6">Elite Signal Examples (Public Preview)</p>
          <blockquote className="border-l-4 border-cyan-500 pl-6 py-4 bg-white/5 rounded-r-xl text-gray-300 italic">
            Below are realistic historical-style examples of Conviction Signals. They demonstrate structure, transparency, and post-event review — not promises.
          </blockquote>
        </section>

        {/* CASE 1 */}
        <section className="py-12 border-t border-white/10">
          <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
            <span className="text-gray-500 text-lg">Case 1</span>
            Political Market
          </h2>
          
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">🔥 Conviction Signal</span>
              <span className="text-gray-400 text-sm">US Election – Trump Wins</span>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <ul className="space-y-3 text-gray-300 text-sm">
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Outcome</span> <span className="text-emerald-400 font-bold">YES</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Conviction Score</span> <span className="text-violet-300 font-bold">8.8 / 10</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Supporting Addresses</span> <span className="text-white">3</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Total Capital</span> <span className="text-white">~$640,000</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Entry Range</span> <span className="text-white">0.38 – 0.41</span></li>
                <li className="flex justify-between"><span>Holding Duration</span> <span className="text-white">6 days</span></li>
              </ul>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Context</h4>
                  <ul className="space-y-2 text-gray-400 text-sm list-disc pl-4">
                    <li>Multiple high-accuracy addresses accumulated early</li>
                    <li>No hedging behavior detected</li>
                    <li>Buying occurred before major narrative shift</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Result (Post-Resolution)</h4>
                  <ul className="space-y-2 text-gray-300 text-sm list-disc pl-4">
                    <li>Price peak: <span className="text-white">0.55</span></li>
                    <li>Max favorable move: <span className="text-emerald-400 font-bold">+34%</span></li>
                    <li>Signal archived after exit</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CASE 2 */}
        <section className="py-12 border-t border-white/10">
          <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
            <span className="text-gray-500 text-lg">Case 2</span>
            Crypto / Macro Market
          </h2>
          
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">🔥 Conviction Signal</span>
              <span className="text-gray-400 text-sm">BTC ETF Approval by Jan 31</span>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <ul className="space-y-3 text-gray-300 text-sm">
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Outcome</span> <span className="text-emerald-400 font-bold">YES</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Conviction Score</span> <span className="text-violet-300 font-bold">9.1 / 10</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Supporting Addresses</span> <span className="text-white">4</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Total Capital</span> <span className="text-white">~$1.12M</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Entry Range</span> <span className="text-white">0.52 – 0.56</span></li>
                <li className="flex justify-between"><span>Holding Duration</span> <span className="text-white">3 days</span></li>
              </ul>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Context</h4>
                  <ul className="space-y-2 text-gray-400 text-sm list-disc pl-4">
                    <li>Rapid whale accumulation over short window</li>
                    <li>Strong alignment across independent addresses</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Result</h4>
                  <ul className="space-y-2 text-gray-300 text-sm list-disc pl-4">
                    <li>Price moved to 0.68 within 48h</li>
                    <li>Peak move: <span className="text-emerald-400 font-bold">+26%</span></li>
                    <li>Limited drawdown observed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CASE 3 */}
        <section className="py-12 border-t border-white/10">
          <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
            <span className="text-gray-500 text-lg">Case 3</span>
            Geopolitical Market
          </h2>
          
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">🔥 Conviction Signal</span>
              <span className="text-gray-400 text-sm">Middle East Ceasefire by Q2</span>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <ul className="space-y-3 text-gray-300 text-sm">
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Outcome</span> <span className="text-emerald-400 font-bold">YES</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Conviction Score</span> <span className="text-violet-300 font-bold">8.3 / 10</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Supporting Addresses</span> <span className="text-white">2</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Total Capital</span> <span className="text-white">~$410,000</span></li>
                <li className="flex justify-between border-b border-white/5 pb-2"><span>Entry Range</span> <span className="text-white">0.61 – 0.63</span></li>
                <li className="flex justify-between"><span>Holding Duration</span> <span className="text-white">5 days</span></li>
              </ul>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Context</h4>
                  <ul className="space-y-2 text-gray-400 text-sm list-disc pl-4">
                    <li>Gradual accumulation</li>
                    <li>No panic exits during volatility spikes</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Result</h4>
                  <ul className="space-y-2 text-gray-300 text-sm list-disc pl-4">
                    <li>Price range expanded to 0.71</li>
                    <li>Signal resolved without adverse swing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TELEGRAM SAMPLE FEED */}
        <section className="py-12 border-t border-white/10">
          <h2 className="text-2xl font-bold mb-4 text-white">Telegram Sample Feed</h2>
          <p className="text-gray-400 mb-6">7-Day Historical Preview</p>
          <blockquote className="mb-8 border-l-4 border-gray-600 pl-6 py-2 text-gray-400 italic">
            This is an example feed showing how Whale Intelligence appears in real usage.
          </blockquote>

          <div className="space-y-6 max-w-2xl mx-auto">
            {[
              { day: "Day 1", content: "🐋 WHALE ALERT\nMarket: Trump Wins Election\nAction: BUY YES\nSize: $184,000 @ 0.41\nWhale Score: 7.7" },
              { day: "Day 2", content: "🐋 WHALE ACCUMULATION DETECTED\nMarket: BTC ETF Approval\nTotal Size (6h): $296,000\nWhale Score: 8.2" },
              { day: "Day 3", content: "📊 WHALE FLOW UPDATE\nMarket: Middle East Ceasefire\nWhale / Total Volume: 36%\nNet Flow: +$210K" },
              { day: "Day 4", content: "🧠 SMART MONEY ACTIVITY\nAddress: 0xA9…F32\nHistorical Win Rate: 71%\nNew Position: $92K" },
              { day: "Day 5", content: "🔥 CONVICTION SIGNAL\nMarket: BTC ETF Approval\nConviction Score: 9.1" },
              { day: "Day 6", content: "📈 SIGNAL REVIEW\nBTC ETF Approval\nAlert Price: 0.54 → 0.66 (+22%)" },
              { day: "Day 7", content: "🐋 WHALE ALERT\nMarket: US Election – Biden Wins\nAction: SELL NO\nSize: $158,000\nWhale Score: 7.4" }
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-16 pt-2 text-xs text-gray-500 font-mono text-right">{item.day}</div>
                <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg p-4 font-mono text-sm text-gray-300 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/50"></div>
                  <pre className="whitespace-pre-wrap font-sans">{item.content}</pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 border-t border-white/10 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">How This Is Used</h2>
          <ul className="flex flex-wrap justify-center gap-6 mb-10 text-gray-400">
            <li className="flex items-center gap-2"><span className="text-violet-500">✓</span> Public preview</li>
            <li className="flex items-center gap-2"><span className="text-violet-500">✓</span> Onboarding</li>
            <li className="flex items-center gap-2"><span className="text-violet-500">✓</span> Transparency</li>
          </ul>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/" className="btn-primary px-8 py-3 text-lg">
              Get Real-Time Whale Alerts →
            </Link>
            <Link href="/backtesting" className="btn-secondary px-8 py-3 text-lg">
              View Backtesting Results →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
