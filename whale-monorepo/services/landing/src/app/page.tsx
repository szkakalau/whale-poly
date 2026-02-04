import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const CTA_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || "/subscribe";
const FREE_CTA_URL = process.env.NEXT_PUBLIC_FREE_SUBSCRIPTION_URL || "/subscribe";

export default function Home() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[20%] right-[20%] w-[20%] h-[20%] bg-indigo-500/10 rounded-full blur-[80px]"></div>
      </div>

      {/* Navigation */}
      <Header />

      <main className="relative pt-32 pb-20">

        {/* HERO SECTION */}
        <section className="relative px-6 max-w-7xl mx-auto text-center mb-48 pt-10">
          <div className="animate-fade-in opacity-0" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-10 border border-violet-500/30 text-violet-200 text-sm hover:border-violet-400/50 transition-all cursor-default hover:scale-105">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Tracking <span className="font-bold text-white tracking-tight">$1.2B+</span> in Prediction Market Volume
            </div>
          </div>

          <h1 className="animate-fade-in opacity-0 text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-10 leading-[1.05] md:leading-[1.05]" style={{ animationDelay: '0.2s' }}>
            Follow the <span className="text-gradient relative inline-block">
              Whales
              <span className="absolute -inset-2 blur-3xl bg-violet-500/20 -z-10"></span>
            </span>.<br />
            Frontrun the <span className="text-transparent bg-clip-text bg-gradient-to-b from-gray-500 to-gray-800 decoration-gray-800 line-through decoration-4 decoration-wavy">Crowd</span>.
          </h1>
          
          <p className="animate-fade-in opacity-0 mt-10 max-w-3xl mx-auto text-xl md:text-2xl text-gray-400 leading-relaxed font-light" style={{ animationDelay: '0.3s' }}>
            The ultimate intelligence layer for Polymarket. We track the <em className="text-violet-300 not-italic font-medium">real money</em> moving the markets — before it hits the headlines.
          </p>

          <div className="animate-fade-in opacity-0 mt-12 flex flex-col sm:flex-row justify-center gap-4" style={{ animationDelay: '0.4s' }}>
            <a href={CTA_URL} className="btn-primary text-lg px-8 py-4 group">
              Get Whale Alerts 
              <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">→</span>
            </a>
            <Link href="#sample-signals" className="btn-secondary text-lg px-8 py-4 hover:bg-white/5">
              View Sample Signals
            </Link>
          </div>

          <div className="animate-fade-in opacity-0 mt-12 flex flex-wrap justify-center gap-4" style={{ animationDelay: '0.6s' }}>
            <Link href="/backtesting" className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-violet-500/20 text-violet-300 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Performance</div>
                <div className="text-sm text-gray-200 font-semibold group-hover:text-white">Backtesting Results</div>
              </div>
            </Link>

            <Link href="/conviction" className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Deep Dive</div>
                <div className="text-sm text-gray-200 font-semibold group-hover:text-white">Conviction Cases</div>
              </div>
            </Link>
          </div>
        </section>

        {/* ONBOARDING - 3 STEPS */}
        <section className="max-w-5xl mx-auto px-6 mb-40">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-violet-400 tracking-[0.2em] uppercase mb-4">
              Getting started
            </h2>
            <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Go live in three simple steps.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass rounded-[2rem] border border-white/10 p-8 flex flex-col gap-6 hover:border-violet-500/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                  1
                </div>
                <div className="text-lg font-bold text-white">
                  Activation
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Open the Telegram bot and run <span className="font-mono text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">/start</span>{' '}
                to generate your personal activation code.
              </p>
            </div>
            <div className="glass rounded-[2rem] border border-white/10 p-8 flex flex-col gap-6 hover:border-cyan-500/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                  2
                </div>
                <div className="text-lg font-bold text-white">
                  Subscription
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Go to <span className="font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded">/subscribe</span>, paste the code
                and complete checkout for your plan.
              </p>
            </div>
            <div className="glass rounded-[2rem] border border-white/10 p-8 flex flex-col gap-6 hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                  3
                </div>
                <div className="text-lg font-bold text-white">
                  Configuration
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Open <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">/follow</span> or{' '}
                <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">/collections</span> to customize your tracking.
              </p>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="border-y border-white/5 bg-white/[0.01] backdrop-blur-sm py-24 mb-40">
          <div className="max-w-6xl mx-auto px-6">
            <blockquote className="text-4xl md:text-5xl font-bold text-center text-white tracking-tight mb-20 leading-tight">
              “We don’t predict outcomes. <br className="hidden md:block" />We <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">track capital</span>.”
            </blockquote>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { icon: "⚡️", title: "Real Data", desc: "Built on real on-chain & orderbook data" },
                { icon: "🛡", title: "No Hype", desc: "No anonymous tips, no hype calls" },
                { icon: "✅", title: "Verifiable", desc: "Every signal is verifiable & reviewable" }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-4 p-8 rounded-3xl hover:bg-white/[0.03] transition-all duration-300 border border-transparent hover:border-white/5">
                  <div className="text-5xl mb-4 grayscale hover:grayscale-0 transition-all duration-500">{item.icon}</div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{item.title}</h3>
                  <div className="text-gray-400 font-medium leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* THE PROBLEM & SOLUTION GRID */}
        <section className="max-w-7xl mx-auto px-6 mb-48">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                Prediction markets are hard because of <em className="text-red-400 not-italic bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">noise</em>.
              </h2>
              
              <div className="space-y-8">
                {[
                  "Headlines move faster than facts",
                  "Retail sentiment is loud and misleading",
                  "By the time a narrative is obvious, price already moved"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-6 group">
                    <div className="mt-2 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] group-hover:scale-125 transition-transform"></div>
                    <span className="text-xl text-gray-400 group-hover:text-gray-200 transition-colors">{item}</span>
                  </div>
                ))}
              </div>
              
              <div className="glass p-8 rounded-2xl border-l-4 border-l-violet-500 shadow-xl">
                <p className="text-2xl text-gray-200 font-light leading-relaxed">
                  Meanwhile, <strong className="text-violet-300 font-bold tracking-tight">smart money</strong> acts quietly — early, consistently, and with size.
                </p>
              </div>
            </div>

            <div className="glass rounded-[3rem] p-10 md:p-16 relative overflow-hidden group border-white/10 hover:border-cyan-500/30 transition-all duration-700 shadow-2xl">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] group-hover:bg-cyan-500/20 transition-all duration-700"></div>
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px] group-hover:bg-violet-500/20 transition-all duration-700"></div>
              
              <div className="relative z-10">
                <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400 mb-4">The Solution</h2>
                <h3 className="text-5xl md:text-6xl font-bold text-white mb-10 tracking-tight">We surface <span className="text-gradient-accent">Truth</span>.</h3>
                
                <p className="text-xl text-gray-400 mb-10 leading-relaxed">Polymarket Whale Intelligence monitors:</p>
                <ul className="grid gap-5 mb-12">
                  {[
                    "Large trades that move markets",
                    "Addresses with strong historical accuracy",
                    "Repeated accumulation patterns",
                    "Capital flows before major price moves"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-5 text-gray-200 bg-white/[0.03] p-4 rounded-2xl border border-white/5 group/item hover:bg-white/[0.06] transition-all">
                      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover/item:scale-110 transition-transform">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      <span className="text-lg font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-lg text-gray-500 border-t border-white/10 pt-8 leading-relaxed">
                  You see <span className="text-white font-bold">who</span> is betting, <span className="text-white font-bold">how much</span>, <span className="text-white font-bold">when</span>, and <span className="text-white font-bold text-glow">with what conviction</span>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES BENTO GRID */}
        <section id="sample-signals" className="max-w-7xl mx-auto px-6 mb-64">
          <div className="text-center mb-32">
            <h2 className="section-title">Intelligence Platform</h2>
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">Everything you need to track the flow of funds in real-time.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 md:gap-12 auto-rows-[minmax(250px,auto)]">
            
            {/* Feature 1: Alerts (Large Card) */}
            <div className="card md:col-span-2 md:row-span-2 relative overflow-hidden group p-10 md:p-14 flex flex-col justify-between">
              <div className="absolute -right-20 -top-20 w-[400px] h-[400px] bg-violet-600/20 rounded-full blur-[120px] group-hover:bg-violet-600/30 transition-all duration-700"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-6 mb-8">
                  <div className="p-4 bg-violet-500/20 rounded-2xl text-4xl shadow-inner group-hover:scale-110 transition-transform">🐋</div>
                  <h3 className="text-4xl font-bold tracking-tight text-white">Whale Alerts</h3>
                </div>
                <p className="text-gray-400 text-xl mb-12 max-w-lg leading-relaxed font-light">Real-time notifications sent directly to your device when unusually large or aggressive trades hit the market.</p>
                
                <div className="bg-[#050505] border border-white/10 rounded-[2rem] p-10 font-mono text-base leading-relaxed relative overflow-hidden shadow-2xl transform transition-all group-hover:scale-[1.02] group-hover:border-violet-500/30 duration-700">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-violet-500 to-cyan-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex justify-between text-sm text-gray-500 mb-6 border-b border-white/5 pb-4">
                    <span className="flex items-center gap-3 font-bold tracking-widest"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> LIVE SIGNAL</span>
                    <span className="font-bold">JUST NOW</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-5 relative z-10">
                    <span className="text-gray-500 font-medium">Market</span>
                    <span className="text-white font-bold truncate">US Election – Trump Wins</span>
                    
                    <span className="text-gray-500 font-medium">Outcome</span>
                    <span className="text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-lg w-fit font-bold">YES</span>
                    
                    <span className="text-gray-500 font-medium">Action</span>
                    <span className="text-emerald-400 font-black tracking-tight">BUY (Aggressive)</span>
                    
                    <span className="text-gray-500 font-medium">Size</span>
                    <span className="text-white font-bold">$182,400</span>
                    
                    <span className="text-gray-500 font-medium">Avg Price</span>
                    <span className="text-white font-bold">0.41</span>
                    
                    <span className="text-gray-500 font-medium">Whale Score</span>
                    <span className="text-violet-400 font-black flex items-center gap-3">
                      7.8 / 10
                      <div className="h-2 w-20 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full w-[78%] bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Watchlist */}
            <div className="card flex flex-col justify-between group hover:border-cyan-500/30 p-10">
              <div>
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-3 bg-cyan-500/20 rounded-xl text-3xl group-hover:rotate-12 transition-transform">🧠</div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Smart Watchlist</h3>
                </div>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed font-light">Stop guessing. Follow the addresses that actually make money.</p>
                <ul className="space-y-4 text-base text-gray-300">
                  <li className="flex items-center gap-4 group/li"><div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover/li:scale-125 transition-transform"></div>Historical PnL tracking</li>
                  <li className="flex items-center gap-4 group/li"><div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover/li:scale-125 transition-transform"></div>Win-rate analysis</li>
                  <li className="flex items-center gap-4 group/li"><div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover/li:scale-125 transition-transform"></div>Live position monitoring</li>
                </ul>
              </div>
            </div>

            {/* Feature 3: Health Alpha (New) */}
            <div className="card bg-gradient-to-br from-emerald-950/40 to-black border-emerald-500/20 group hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] p-10 flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-2xl font-bold text-emerald-100 tracking-tight">🏥 Health Alpha</h3>
                <div className="px-3 py-1 rounded-full text-[10px] bg-emerald-500 text-white font-black tracking-widest shadow-lg">NEW</div>
              </div>
              
              <ul className="space-y-5 text-base text-gray-300 mb-10">
                {[
                  "Specialized tracking for medical markets",
                  "Monitor high-stakes clinical trial bets",
                  "Identify health-sector domain experts"
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 group/li">
                    <span className="text-emerald-400 font-mono font-bold group-hover/li:translate-x-1 transition-transform">0{i+1}</span>
                    <span className="text-gray-300 font-light">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-auto text-sm text-emerald-200/50 border-t border-white/5 pt-6 font-medium">Domain intelligence for <strong className="text-emerald-400 font-bold">life-science</strong> markets.</p>
            </div>

            {/* Feature 4: Conviction */}
            <div className="card bg-gradient-to-br from-violet-950/40 to-black border-violet-500/20 group hover:shadow-[0_0_40px_rgba(139,92,246,0.15)] p-10 flex flex-col md:col-span-1">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-2xl font-bold text-violet-100 tracking-tight">🔥 Conviction</h3>
                <div className="px-3 py-1 rounded-full text-[10px] bg-violet-500 text-white font-black tracking-widest shadow-lg">ELITE</div>
              </div>
              
              <ul className="space-y-5 text-base text-gray-300 mb-10">
                {[
                  "Multiple smart money addresses align",
                  "Capital size is significant",
                  "Positions are held over time"
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 group/li">
                    <span className="text-violet-400 font-mono font-bold group-hover/li:translate-x-1 transition-transform">0{i+1}</span>
                    <span className="text-gray-300 font-light">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-auto text-sm text-violet-200/50 border-t border-white/5 pt-6 font-medium">Reflecting <strong className="text-violet-400 font-bold text-glow">strong belief</strong>, not just speculation.</p>
            </div>

            {/* Feature 4: Heatmap (Wide) */}
            <div className="card md:col-span-3 p-10 md:p-12 group hover:border-violet-500/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                <div>
                  <h3 className="text-3xl font-bold flex items-center gap-4 text-white tracking-tight">
                    <span className="text-4xl group-hover:scale-110 transition-transform">📊</span> Market Heatmap
                  </h3>
                  <p className="text-gray-400 text-lg mt-2 font-light">Perfect for research and market discovery.</p>
                </div>
                <div className="flex gap-3">
                  {['Volume', 'Flow', 'Trend'].map((tag) => (
                    <span key={tag} className="px-5 py-2 rounded-xl bg-white/5 text-sm font-bold text-gray-400 border border-white/5 group-hover:border-violet-500/20 transition-all">{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: "Volume Ratio", value: "Whale vs Total", color: "text-cyan-400" },
                  { label: "Flow", value: "Net Inflow", color: "text-emerald-400" },
                  { label: "Trend", value: "Momentum", color: "text-violet-400" }
                ].map((stat, i) => (
                  <div key={i} className="p-8 bg-white/[0.02] rounded-[2rem] border border-white/5 hover:bg-white/[0.05] transition-all group/stat">
                    <div className="text-xs text-gray-500 mb-3 uppercase tracking-[0.2em] font-bold">{stat.label}</div>
                    <div className={`${stat.color} font-mono text-xl font-black group-hover/stat:scale-105 transition-transform`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-6 mb-64">
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-center mb-32 text-white">How It Works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 relative">
            {/* Connecting Line */}
            <div className="hidden sm:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"></div>
            
            {[
              { title: "Ingest", desc: "Real-time trade & orderbook data" },
              { title: "Analyze", desc: "Identify abnormal capital movements" },
              { title: "Score", desc: "Historical accuracy, timing & impact" },
              { title: "Deliver", desc: "Signals via dashboard, Telegram & email" }
            ].map((step, i) => (
              <div key={i} className="relative pt-4 text-center group">
                <div className="w-24 h-24 mx-auto bg-[#030014] border border-violet-500/20 rounded-3xl flex items-center justify-center text-3xl font-black text-violet-400 relative z-10 mb-8 shadow-2xl group-hover:scale-110 group-hover:border-violet-500 group-hover:shadow-[0_0_50px_rgba(139,92,246,0.2)] transition-all duration-500 transform rotate-3 group-hover:rotate-0">
                  {i + 1}
                </div>
                <h4 className="font-bold text-2xl mb-4 text-white tracking-tight">{step.title}</h4>
                <p className="text-gray-400 leading-relaxed px-4 font-light">{step.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-20 text-gray-500 text-sm flex items-center justify-center gap-3 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            Every signal is logged. Every score is auditable.
          </p>
        </section>

        {/* COMPARISON */}
        <section className="max-w-6xl mx-auto px-6 mb-64">
          <div className="glass rounded-[3rem] overflow-hidden p-12 md:p-24 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-center mb-24 text-white">Why We’re Different</h2>
            
            <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
              <div className="space-y-10">
                <h3 className="text-gray-600 font-black mb-10 uppercase tracking-[0.3em] text-xs">Others</h3>
                <ul className="space-y-8">
                  {["Predict outcomes", "Anonymous tips", "Black-box calls", "Cherry-picked wins"].map((item, i) => (
                    <li key={i} className="flex items-center gap-6 text-gray-600 decoration-gray-800 line-through text-lg font-medium">
                      <span className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center text-gray-700 text-xs border border-white/5">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="relative p-10 bg-white/[0.02] rounded-[2rem] border border-white/10 shadow-2xl">
                <div className="absolute inset-0 bg-violet-500/5 rounded-[2rem] blur-2xl"></div>
                <h3 className="text-white font-black mb-10 uppercase tracking-[0.3em] text-xs relative">Whale Intelligence</h3>
                <ul className="space-y-8 relative">
                  {[
                    "Track behavior", 
                    "On-chain evidence", 
                    "Explainable signals", 
                    "Full history & stats"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-6 text-white text-xl font-bold tracking-tight">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white text-xs shadow-xl group-hover:scale-110 transition-transform">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 mb-40">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6">Simple Pricing</h2>
            <p className="text-xl text-gray-400 font-light">Start tracking smart money today.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-10 max-w-6xl mx-auto items-stretch">
            
            {/* Free */}
            <div className="card h-full flex flex-col border-white/5 hover:border-white/10 p-10 md:p-12 group">
              <h3 className="text-2xl font-bold text-gray-400 tracking-tight">Free</h3>
              <div className="text-5xl font-black mt-6 mb-8 text-white">$0<span className="text-lg font-normal text-gray-500 tracking-normal ml-1">/mo</span></div>
              <p className="text-gray-500 mb-10 font-medium">Basic access for casual observers.</p>
              <ul className="space-y-6 mb-12 flex-1">
                <li className="flex items-center gap-4 text-gray-400 font-medium"><span className="text-gray-700 text-xl">○</span> Global alerts (delayed)</li>
                <li className="flex items-center gap-4 text-gray-400 font-medium"><span className="text-gray-700 text-xl">○</span> 0 Smart Collections</li>
                <li className="flex items-center gap-4 text-gray-400 font-medium"><span className="text-gray-700 text-xl">○</span> 0 Whale Follows</li>
                <li className="flex items-center gap-4 text-gray-400 font-medium"><span className="text-gray-700 text-xl">○</span> Basic Heatmap</li>
              </ul>
              <a href={FREE_CTA_URL} className="btn-secondary w-full py-5 text-lg font-bold">Get started free</a>
            </div>

            {/* Pro - Highlighted */}
            <div className="card h-full flex flex-col relative border-violet-500/50 bg-violet-950/20 shadow-[0_0_80px_rgba(139,92,246,0.2)] transform lg:-translate-y-8 z-10 hover:scale-[1.03] p-10 md:p-14 duration-500">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.2em] shadow-2xl animate-pulse-slow border border-white/20">
                  Most Popular
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">Pro</h3>
              <div className="text-7xl font-black mt-6 mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white to-violet-300">
                $39<span className="text-xl font-normal text-gray-400 tracking-normal ml-1">/mo</span>
              </div>
              <p className="text-gray-300 mb-10 font-medium">For serious traders who want an edge.</p>
              <ul className="space-y-6 mb-12 flex-1">
                <li className="flex items-center gap-4 text-white font-bold"><span className="text-cyan-400 text-xl">✓</span> Real-time whale alerts</li>
                <li className="flex items-center gap-4 text-white font-bold"><span className="text-cyan-400 text-xl">✓</span> 5 Smart Collections</li>
                <li className="flex items-center gap-4 text-white font-bold"><span className="text-cyan-400 text-xl">✓</span> 100 Whale Follows</li>
                <li className="flex items-center gap-4 text-white font-bold"><span className="text-cyan-400 text-xl">✓</span> Full Market Heatmap</li>
                <li className="flex items-center gap-4 text-white font-bold"><span className="text-cyan-400 text-xl">✓</span> 30-day History</li>
              </ul>
              <a href={CTA_URL} className="btn-primary w-full shadow-[0_20px_40px_rgba(139,92,246,0.3)] text-xl py-6 font-black tracking-tight">Get Pro Access</a>
            </div>

            {/* Elite */}
            <div className="card h-full flex flex-col border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent p-10 md:p-12">
              <h3 className="text-2xl font-bold text-violet-200 tracking-tight">Elite</h3>
              <div className="text-5xl font-black mt-6 mb-8 text-white">$129<span className="text-lg font-normal text-gray-500 tracking-normal ml-1">/mo</span></div>
              <p className="text-gray-500 mb-10 font-medium">Full institutional-grade access.</p>
              <ul className="space-y-6 mb-12 flex-1">
                <li className="flex items-center gap-4 text-gray-300 font-bold"><span className="text-violet-400 text-xl">★</span> Everything in Pro</li>
                <li className="flex items-center gap-4 text-gray-300 font-bold"><span className="text-violet-400 text-xl">★</span> 20 Smart Collections</li>
                <li className="flex items-center gap-4 text-gray-300 font-bold"><span className="text-violet-400 text-xl">★</span> 1,000 Whale Follows</li>
                <li className="flex items-center gap-4 text-gray-300 font-bold"><span className="text-violet-400 text-xl">★</span> Conviction Alpha</li>
                <li className="flex items-center gap-4 text-gray-300 font-bold"><span className="text-violet-400 text-xl">★</span> Unlimited History</li>
              </ul>
              <a href={CTA_URL} className="btn-secondary w-full py-5 text-lg font-bold border-violet-500/30 hover:bg-violet-500/10">Get Elite</a>
            </div>

          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
