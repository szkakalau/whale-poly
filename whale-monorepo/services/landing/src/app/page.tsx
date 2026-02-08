import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const CTA_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || "/subscribe";
const FREE_CTA_URL = process.env.NEXT_PUBLIC_FREE_SUBSCRIPTION_URL || "/subscribe";
const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/sightwhale_bot";

export default function Home() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1] bg-[#020202]" />

      {/* Navigation */}
      <Header />

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Sight Whale",
            "operatingSystem": "Web, Telegram",
            "applicationCategory": "FinanceApplication",
            "description": "Track Polymarket Whale Activity — Before the Crowd Reacts. Get real-time, on-chain intelligence on historically profitable whale behavior delivered to your Telegram.",
            "offers": {
              "@type": "AggregateOffer",
              "lowPrice": "0",
              "highPrice": "299",
              "priceCurrency": "USD"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "ratingCount": "1200"
            }
          })
        }}
      />

      <main className="relative pt-20 pb-12">

        {/* HERO SECTION */}
        <section className="relative px-6 max-w-7xl mx-auto text-center mb-32 pt-12">
              <div>
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass mb-12 border border-white/10 text-gray-300 text-[10px] md:text-xs hover:border-violet-500/50 transition-all cursor-default group relative overflow-hidden bg-white/[0.02]">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="tracking-[0.05em]">Tracking <span className="font-black text-white px-0.5">$1.4B+</span> in Prediction Market Volume</span>
              <svg className="w-3 h-3 text-gray-500 group-hover:text-violet-400 transition-colors ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-8 leading-[1.05]">
            Follow the <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 relative inline-block">
              Score
              <span className="absolute -inset-x-4 -inset-y-2 blur-[16px] bg-violet-500/10 -z-10"></span>
            </span>.<br />
            Frontrun the <span className="text-white">Market</span>.
          </h1>
          
          <p className="mt-8 max-w-2xl mx-auto text-base md:text-xl text-gray-400 leading-relaxed font-light tracking-wide">
            The first AI-driven intelligence layer for Polymarket. We filter millions in noise into <span className="text-white font-medium relative group cursor-help">
              high-conviction signals
              <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-violet-500/50 group-hover:bg-violet-400 group-hover:h-[2px] transition-all"></span>
            </span> using the proprietary Whale Score™.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-6">
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="relative group px-8 py-4 bg-white text-black font-black rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative z-10 flex items-center gap-2">
                Launch Telegram Bot
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg>
              </span>
            </a>
            <Link href="#sample-signals" className="group px-8 py-4 glass border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all flex items-center gap-3">
              View Sample Signals
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 group-hover:scale-[1.5] transition-all"></div>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/backtesting" className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Performance</div>
                <div className="text-xs text-gray-200 font-semibold group-hover:text-white">Backtesting Results</div>
              </div>
            </Link>

            <Link href="/conviction" className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Deep Dive</div>
                <div className="text-xs text-gray-200 font-semibold group-hover:text-white">Conviction Cases</div>
              </div>
            </Link>
          </div>
        </section>

        {/* ONBOARDING - 3 STEPS */}
        <section className="max-w-6xl mx-auto px-6 mb-32">
          <div className="text-center mb-16">
            <h2 className="text-[10px] font-bold text-violet-400 tracking-[0.4em] uppercase mb-6 opacity-80">
              The Protocol
            </h2>
            <p className="text-2xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Institutional grade data. <br />
              <span className="text-gray-500/80">Consumer simple access.</span>
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: 1, title: "Connect", color: "violet", desc: <>One-click sync with your personal intelligence dashboard via <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline decoration-violet-500/30 underline-offset-4 font-bold">@sightwhale_bot</a>.</> },
              { step: 2, title: "Quantify Conviction", color: "cyan", desc: <>Every trade is instantly processed through our Whale Score engine, measuring PnL history and timing precision.</> },
              { step: 3, title: "Shadow", color: "emerald", desc: <>Mirror every move with precision <span className="font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">/follow</span> alerts tailored to your strategy.</> }
            ].map((item, i) => (
              <div key={i} className={`glass rounded-[2rem] border border-white/5 p-8 flex flex-col gap-8 hover:border-${item.color}-500/40 hover:bg-${item.color}-500/[0.03] transition-all duration-700 group relative overflow-hidden`}>
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/10 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:bg-${item.color}-500/20 transition-all duration-1000`}></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className={`w-12 h-12 rounded-2xl bg-${item.color}-500/20 text-${item.color}-300 flex items-center justify-center font-black text-xl group-hover:scale-110 group-hover:bg-${item.color}-500 group-hover:text-white transition-all duration-700`}>
                    {item.step}
                  </div>
                  <div className={`text-[10px] font-black text-${item.color}-400/40 uppercase tracking-[0.3em]`}>Step {item.step === 1 ? 'One' : item.step === 2 ? 'Two' : 'Three'}</div>
                </div>
                <div className="space-y-4 relative z-10">
                  <h3 className="text-xl font-black text-white tracking-tight">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm font-light">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="border-y border-white/5 bg-white/[0.01] py-16 mb-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.02] via-transparent to-cyan-500/[0.02]"></div>
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <blockquote className="text-2xl md:text-3xl font-black text-center text-white tracking-tight mb-12 leading-[1.2]">
              “We don’t predict outcomes. <br className="hidden md:block" />We <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">track capital flow</span>.”
            </blockquote>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: "⚡️", title: "Real-Time Data", desc: "Direct feeds from on-chain clusters & exchange orderbooks." },
                { icon: "🛡", title: "Zero Noise", desc: "No anonymous tips, no hype calls, no black-box indicators." },
                { icon: "✅", title: "100% Verifiable", desc: "Every signal includes direct links to transaction evidence." }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-3 group">
                  <div className="text-4xl mb-1 group-hover:scale-110 transition-transform duration-500">{item.icon}</div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{item.title}</h3>
                  <p className="text-gray-400 font-light leading-relaxed text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* THE PROBLEM & SOLUTION GRID */}
        <section className="max-w-7xl mx-auto px-6 mb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-[10px] font-bold text-red-400 tracking-[0.4em] uppercase mb-5">The Market Problem</h2>
                <h3 className="text-xl md:text-3xl font-black tracking-tight text-white leading-[1.1]">
                  Prediction markets are <br />
                  <span className="text-gray-500 italic">distorted by noise.</span>
                </h3>
              </div>
              
              <div className="space-y-5">
                {[
                  "Headlines move faster than verified facts",
                  "Retail sentiment is loud, emotional, and lagging",
                  "The house always wins because they have better data"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-red-500/40 border border-red-500/60 group-hover:bg-red-500 transition-all"></div>
                    <span className="text-base text-gray-400 group-hover:text-gray-200 transition-colors font-light">{item}</span>
                  </div>
                ))}
              </div>
              
              <div className="glass p-7 rounded-[1.5rem] border-l-4 border-l-violet-500 bg-violet-500/[0.02]">
                <p className="text-base text-gray-300 font-light leading-relaxed">
                  While the crowd follows the news, <strong className="text-white font-bold tracking-tight">smart money</strong> acts quietly — early, with size, and with verifiable conviction.
                </p>
              </div>
            </div>

            <div className="glass rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden group border-white/5 hover:border-cyan-500/30 transition-all duration-700 bg-white/[0.01]">
              <div className="absolute -top-20 -right-20 w-[250px] h-[250px] bg-cyan-500/10 rounded-full blur-[70px] group-hover:bg-cyan-500/20 transition-all duration-1000"></div>
              
              <div className="relative z-10">
                <h2 className="text-[10px] font-bold text-cyan-400 tracking-[0.4em] uppercase mb-5">The Solution</h2>
                <h3 className="text-xl md:text-3xl font-black text-white mb-6 tracking-tight leading-tight">We surface the <br /><span className="text-gradient-accent">Unfair Advantage</span>.</h3>
                
                <ul className="grid gap-3 mb-8">
                  {[
                    "Large trades that shift liquidity",
                    "Wallets with proven Whale Score 70+",
                    "Repeated accumulation clusters",
                    "Capital flows before market breakouts"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-200 bg-white/[0.03] p-3.5 rounded-xl border border-white/5 group/item hover:bg-white/[0.06] transition-all">
                      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover/item:scale-110 group-hover/item:bg-cyan-500 group-hover/item:text-white transition-all duration-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      <span className="text-sm font-medium tracking-tight">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-500 border-t border-white/5 pt-6 leading-relaxed font-light">
                  Transparency on <span className="text-white font-bold">who</span> is betting, <span className="text-white font-bold text-glow">how much</span>, and with what level of conviction.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES BENTO GRID */}
        <section id="sample-signals" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="text-center mb-16">
            <h2 className="section-title tracking-[0.2em] opacity-80 mb-4">Intelligence Platform</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">
              We monitor millions of data points to surface the only ones that matter.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 auto-rows-[minmax(300px,auto)]">
            
            {/* Feature 1: Alerts (Large Card) */}
            <div className="card md:col-span-2 md:row-span-2 relative overflow-hidden p-8 md:p-10 flex flex-col justify-between border-white/5 bg-white/[0.01]">
              <div className="relative z-10">
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-14 h-14 bg-violet-500/15 rounded-2xl flex items-center justify-center text-3xl border border-violet-500/20">🐋</div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-white mb-1">Whale Score Filter</h3>
                    <div className="text-violet-400 font-bold text-[10px] uppercase tracking-[0.3em]">Kill the Noise. Only Follow the 70+.</div>
                  </div>
                </div>
                <p className="text-gray-400 text-base mb-8 max-w-xl leading-relaxed font-light">
                  Stop chasing every $10k bet. Our scoring system (0-100) separates &quot;Dumb Large Money&quot; from the elite 1% who actually move the needle.
                </p>
                
                <div className="bg-[#010101] border border-white/10 rounded-2xl p-6 font-mono text-sm leading-relaxed relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-violet-500 via-indigo-500 to-cyan-500"></div>
                  
                  <div className="flex justify-between text-[8px] text-gray-500 mb-3.5 border-b border-white/5 pb-2.5">
                    <span className="flex items-center gap-2 font-black tracking-[0.2em] text-violet-400"><span className="w-1 h-1 rounded-full bg-red-500"></span> LIVE SIGNAL</span>
                    <span className="font-bold tracking-widest opacity-50 font-sans uppercase">Processing...</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2.5 relative z-10">
                    <span className="text-gray-500 font-bold uppercase text-[8px] tracking-widest">Market</span>
                    <span className="text-white font-black truncate text-xs">US Election – Trump Wins</span>
                    
                    <span className="text-gray-500 font-bold uppercase text-[8px] tracking-widest">Outcome</span>
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md w-fit font-black text-[9px] ring-1 ring-emerald-400/20">YES</span>
                    
                    <span className="text-gray-500 font-bold uppercase text-[8px] tracking-widest">Action</span>
                    <span className="text-emerald-400 font-black tracking-tighter text-sm">AGGRESSIVE BUY</span>
                    
                    <span className="text-gray-500 font-bold uppercase text-[8px] tracking-widest">Size</span>
                    <span className="text-white font-black text-sm">$182,400.00</span>
                    
                    <span className="text-gray-500 font-bold uppercase text-[8px] tracking-widest">Whale Score</span>
                    <div className="flex items-center gap-3">
                      <span className="text-violet-400 font-black text-xs">8.4</span>
                      <div className="h-1 w-16 bg-gray-900 rounded-full overflow-hidden ring-1 ring-white/5">
                      <div className="h-full w-[84%] bg-gradient-to-r from-violet-600 to-violet-400"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Smart Collections */}
            <div className="card relative overflow-hidden p-8 flex flex-col justify-between border-white/5 bg-white/[0.01]">
              <div className="relative z-10">
                <div className="w-14 h-14 bg-cyan-500/15 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-cyan-500/20">💎</div>
                <h3 className="text-xl font-black text-white mb-3 tracking-tight">Smart Collections</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-light">
                  Automated grouping of whales by strategy, win rate, and market bias.
                </p>
              </div>
              <div className="mt-8 space-y-3 relative z-10">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-gradient-to-r from-cyan-600 to-cyan-400"></div>
                </div>
                <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  <span>Clustering Data</span>
                  <span className="text-cyan-400">Active</span>
                </div>
              </div>
            </div>

            {/* Feature 3: Alpha Tracking */}
            <div className="card relative overflow-hidden p-8 flex flex-col justify-between border-white/5 bg-white/[0.01]">
              <div className="relative z-10">
                <div className="w-14 h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-emerald-500/20">🚀</div>
                <h3 className="text-xl font-black text-white mb-3 tracking-tight">Alpha Tracking</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-light">
                  Discover hidden wallets before they hit the leaderboard rankings.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 relative z-10">
                <div className="flex -space-x-3">
                  {[1,2,3].map(i => <div key={i} className="w-9 h-9 rounded-full border-2 border-[#050505] bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400">W{i}</div>)}
                </div>
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter ml-2">+42 New Whales</div>
              </div>
            </div>

            {/* Feature 4: Conviction */}
            <div className="card border-violet-500/20 p-8 flex flex-col md:col-span-2 relative overflow-hidden bg-white/[0.01]">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔥</span>
                  <h3 className="text-xl font-black text-white tracking-tight">Conviction</h3>
                </div>
                <div className="px-3 py-1 rounded-full text-[10px] bg-violet-500 text-white font-black tracking-[0.2em]">ELITE</div>
              </div>
              
              <ul className="grid md:grid-cols-2 gap-x-10 gap-y-5 text-sm text-gray-300 mb-10 relative z-10">
                {[
                  "Multiple smart money addresses align",
                  "Capital size is significant",
                  "Positions are held over time",
                  "Historically accurate whale entry"
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="text-violet-400 font-black font-mono">0{i+1}</span>
                    <span className="text-gray-400 font-light">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-6 relative z-10">
                <p className="text-[11px] text-violet-200/50 font-medium">Reflecting <strong className="text-violet-400 font-black tracking-wide">strong belief</strong>, not just speculation.</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-3 rounded-full bg-violet-500/20"></div>)}
                </div>
              </div>
            </div>

            {/* Feature 5: Results */}
            <div className="card border-indigo-500/20 p-8 flex flex-col relative overflow-hidden bg-white/[0.01]">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📈</span>
                  <h3 className="text-xl font-black text-white tracking-tight">Results</h3>
                </div>
                <div className="px-3 py-1 rounded-full text-[10px] bg-indigo-500 text-white font-black tracking-[0.2em]">STATS</div>
              </div>
              
              <div className="space-y-5 relative z-10">
                {[
                  { label: "Win Rate", value: "72%", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { label: "Avg ROI", value: "+18.4%", color: "text-cyan-400", bg: "bg-cyan-500/10" },
                  { label: "Total Signals", value: "1,240+", color: "text-indigo-400", bg: "bg-indigo-500/10" }
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                    <div className="flex items-center gap-3">
                      <span className={`${stat.color} font-black text-lg font-mono tracking-tighter`}>{stat.value}</span>
                      <div className={`w-2 h-2 rounded-full ${stat.bg}`}></div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-auto text-[10px] text-gray-500 font-medium italic pt-6 border-t border-white/5 relative z-10">Based on last 90 days of tracked signals.</p>
            </div>

            {/* Feature 6: Heatmap (Wide) */}
            <div className="card md:col-span-3 p-10 md:p-12 bg-white/[0.01] relative overflow-hidden border-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 relative z-10">
                <div>
                  <h3 className="text-3xl font-black flex items-center gap-4 text-white tracking-tight">
                    <span className="text-4xl">📊</span> Market Heatmap
                  </h3>
                  <p className="text-gray-400 text-lg mt-2 font-light">Perfect for research and market discovery.</p>
                </div>
                <div className="flex gap-3">
                  {['Volume', 'Flow', 'Trend'].map((tag) => (
                    <span key={tag} className="px-5 py-2 rounded-xl bg-white/5 text-[11px] font-black text-gray-500 border border-white/5 cursor-default uppercase tracking-widest">{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
                {[
                  { label: "Volume Ratio", value: "Whale vs Total", color: "text-cyan-400" },
                  { label: "Flow", value: "Net Inflow", color: "text-emerald-400" },
                  { label: "Trend", value: "Momentum", color: "text-violet-400" }
                ].map((stat, i) => (
                  <div key={i} className="p-8 bg-white/[0.02] rounded-[2rem] border border-white/5">
                    <div className="text-[10px] text-gray-500 mb-4 uppercase tracking-[0.3em] font-black">{stat.label}</div>
                    <div className={`${stat.color} font-mono text-xl font-black`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-6 mb-32 relative">
          <div className="text-center mb-20">
            <h2 className="text-[11px] font-black text-violet-400 tracking-[0.5em] uppercase mb-6 opacity-80">
              The Engine
            </h2>
            <p className="text-3xl md:text-5xl font-black text-white tracking-tight mb-6">How It Works</p>
            <div className="w-24 h-1 bg-gradient-to-r from-violet-500 to-cyan-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Connecting Line - Pro Max: Dynamic gradient line */}
            <div className="hidden lg:block absolute top-[40%] left-0 w-full h-[2px] bg-[linear-gradient(to_right,transparent,rgba(139,92,246,0.2),rgba(34,211,238,0.2),transparent)]"></div>
            
            {[
              { title: "Ingest", desc: "Real-time trade & orderbook data", icon: "📡" },
              { title: "Analyze", desc: "Identify abnormal capital movements", icon: "🧠" },
              { title: "Score", desc: "Historical accuracy, timing & impact", icon: "🎯" },
              { title: "Deliver", desc: "Signals via dashboard, Telegram & email", icon: "📬" }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="glass rounded-[2.5rem] p-10 h-full border-white/5 hover:border-violet-500/40 hover:bg-violet-500/[0.02] transition-all duration-700 flex flex-col items-center text-center group-hover:translate-y-[-8px] shadow-2xl">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-violet-500/15 text-violet-400 flex items-center justify-center text-2xl font-black mb-8 group-hover:bg-violet-500 group-hover:text-white transition-all duration-700 shadow-[0_0_30px_rgba(139,92,246,0.2)] group-hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] group-hover:rotate-6">
                    {i + 1}
                  </div>
                  <div className="text-3xl mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700">{step.icon}</div>
                  <h4 className="font-black text-2xl mb-4 text-white tracking-tight">{step.title}</h4>
                  <p className="text-gray-400 leading-relaxed text-sm font-light">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 text-gray-500 text-sm font-bold tracking-tight">
              <div className="flex -space-x-3">
                {[1,2,3,4,5].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-[#020202] bg-gray-800 shadow-xl"></div>)}
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-400 to-gray-600">Trusted by 2,000+ active traders</span>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="max-w-6xl mx-auto px-6 mb-32">
          <div className="glass rounded-[3rem] overflow-hidden p-12 md:p-20 relative bg-white/[0.01] border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            {/* Pro Max: Animated top border */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
            
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-4">Why We’re Different</h2>
              <p className="text-gray-500 text-lg font-light">The transparency advantage in a black-box market.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-stretch">
              <div className="space-y-10 p-10 rounded-[2.5rem] bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-gray-600 font-black uppercase tracking-[0.4em] text-[11px]">Standard Tools</p>
                <ul className="space-y-8">
                  {["Predictive guessing", "Anonymous chat tips", "Black-box indicators", "Opaque track records"].map((item, i) => (
                    <li key={i} className="flex items-center gap-5 text-gray-600 line-through text-lg font-medium opacity-50 group">
                      <div className="w-6 h-6 rounded-full bg-gray-900 border border-white/5 flex items-center justify-center text-[10px] group-hover:border-red-500/30 transition-colors">✕</div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="relative p-10 rounded-[2.5rem] bg-violet-600/[0.02] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.05)] overflow-hidden group">
                <div className="absolute inset-0 bg-violet-500/[0.02] blur-3xl group-hover:bg-violet-500/[0.05] transition-colors duration-1000"></div>
                <p className="text-violet-400 font-black uppercase tracking-[0.4em] text-[11px] mb-10 relative">Whale Intelligence</p>
                <ul className="space-y-8 relative">
                  {[
                    "Verified behavior tracking", 
                    "Full on-chain evidence", 
                    "Explainable logic engine", 
                    "Auditable historical performance"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-5 text-white text-xl font-black tracking-tight group/li">
                      <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] group-hover/li:scale-110 transition-transform">✓</div>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-12 pt-8 border-t border-white/5 relative">
                  <p className="text-gray-400 text-sm italic font-light leading-relaxed">&quot;The most transparent data in DeFi.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 mb-24">
          <div className="text-center mb-16">
            <h2 className="text-[10px] font-black text-violet-400 tracking-[0.4em] uppercase mb-4">
              Pricing
            </h2>
            <p className="text-2xl md:text-4xl font-black text-white tracking-tight mb-4 leading-tight">
              Institutional data. <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-400 via-gray-200 to-gray-500">Retail simplicity.</span>
            </p>
            <p className="text-base text-gray-400 font-light max-w-2xl mx-auto">Choose the intelligence level that matches your market participation.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            
            {/* Free */}
            <div className="glass rounded-[2rem] h-full flex flex-col border-white/5 p-7 bg-white/[0.01]">
              <h3 className="text-xs font-bold text-gray-500 tracking-tight uppercase mb-5">Free</h3>
              <div className="text-4xl font-black mb-5 text-white tracking-tighter">$0<span className="text-base font-normal text-gray-600 tracking-normal ml-1.5">/mo</span></div>
              <p className="text-gray-500 mb-8 text-sm font-light leading-relaxed">Basic intelligence for casual observers.</p>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "3 alerts per day",
                  "10-min delayed signals",
                  "Whale Score visibility",
                  "No custom /follow alerts",
                  "No custom collections",
                  "No smart collections access"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-400 font-medium text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <a href="/dashboard" className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-center text-xs">Get started free</a>
            </div>

            {/* Pro - Most Popular (Center Reinforcement) */}
            <div className="glass rounded-[2.5rem] h-full flex flex-col border-violet-500/40 p-8 relative overflow-hidden bg-white/[0.01]">
              <div className="absolute top-0 right-0 px-6 py-2 bg-violet-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-bl-2xl z-20">Most Popular</div>
              
              <h3 className="text-xs font-bold text-violet-400 tracking-tight uppercase mb-6">Pro</h3>
              <div className="text-6xl font-black mb-6 text-white tracking-tighter">$29<span className="text-lg font-normal text-violet-300/40 tracking-normal ml-2">/mo</span></div>
              <p className="text-gray-200 mb-8 text-sm font-light leading-relaxed">For professional traders who need immediate edges.</p>
              
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  "Unlimited real-time alerts",
                  "Follow up to 20 whales",
                  "Create up to 3 collections",
                  "Subscribe to 5 Smart Collections",
                  "Full Whale Score visibility",
                  "Full Telegram Bot features"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-gray-100 font-bold text-xs">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              
              <a 
                href="/subscribe?plan=pro"
                className="w-full py-4 rounded-2xl bg-violet-600 text-white font-black text-base text-center"
              >
                Upgrade to Pro
              </a>
            </div>

            {/* Elite */}
            <div className="glass rounded-[2rem] h-full flex flex-col border-white/5 p-7 bg-white/[0.01]">
              <h3 className="text-xs font-bold text-gray-500 tracking-tight uppercase mb-5">Elite</h3>
              <div className="text-4xl font-black mb-5 text-white tracking-tighter">$59<span className="text-base font-normal text-gray-600 tracking-normal ml-1.5">/mo</span></div>
              <p className="text-gray-500 mb-8 text-sm font-light leading-relaxed">The ultimate toolkit for high-net-worth operators.</p>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Unlimited real-time alerts",
                  "Follow up to 100 whales",
                  "Unlimited collections",
                  "Subscribe to 20 Smart Collections",
                  "Priority Whale Score updates",
                  "Exclusive alpha channel access"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-400 font-medium text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <a 
                href="/subscribe?plan=elite"
                className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-center text-xs"
              >
                Go Elite
              </a>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
