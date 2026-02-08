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
      <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#050505]">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-violet-600/15 rounded-full blur-[140px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-600/10 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '3s' }}></div>
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-float"></div>
        
        {/* Animated Grid Lines with refined masking */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        
        {/* Subtle radial overlay for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent_0%,#050505_100%)]"></div>
      </div>

      {/* Navigation */}
      <Header />

      <main className="relative pt-20 pb-12">

        {/* HERO SECTION */}
        <section className="relative px-6 max-w-7xl mx-auto text-center mb-24 pt-8">
          <div className="animate-fade-in opacity-0" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-10 border border-white/10 text-gray-300 text-xs md:text-sm hover:border-violet-500/40 transition-all cursor-default hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] group">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Tracking <span className="font-bold text-white tracking-tight px-1">$1.4B+</span> in Prediction Market Volume
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </div>

          <h1 className="animate-fade-in opacity-0 text-3xl md:text-5xl lg:text-6xl font-black tracking-tight mb-5 leading-[1.1]" style={{ animationDelay: '0.2s' }}>
            Follow the <span className="text-gradient relative inline-block">
              Whales
              <span className="absolute -inset-8 blur-[100px] bg-violet-500/20 -z-10"></span>
            </span>.<br />
            Frontrun the <span className="text-transparent bg-clip-text bg-gradient-to-b from-white/90 to-white/40">Crowd</span>.
          </h1>
          
          <p className="animate-fade-in opacity-0 mt-5 max-w-2xl mx-auto text-base md:text-lg text-gray-400 leading-relaxed font-light" style={{ animationDelay: '0.3s' }}>
            The ultimate intelligence layer for Polymarket. We surface the <span className="text-white font-medium underline decoration-violet-500/50 decoration-2 underline-offset-4">smart money</span> moving markets — before the noise begins.
          </p>

          <div className="animate-fade-in opacity-0 mt-8 flex flex-col sm:flex-row justify-center items-center gap-5" style={{ animationDelay: '0.4s' }}>
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary text-base px-8 py-3.5 group shadow-[0_10px_25px_rgba(139,92,246,0.15)] hover:shadow-[0_15px_35px_rgba(139,92,246,0.25)] transform hover:-translate-y-1 transition-all duration-300">
              Launch Telegram Bot
              <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block font-bold">→</span>
            </a>
            <Link href="#sample-signals" className="text-gray-400 hover:text-white transition-colors text-sm md:text-base font-medium flex items-center gap-2 group">
              View Sample Signals
              <span className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-violet-500 transition-colors"></span>
            </Link>
          </div>

          <div className="animate-fade-in opacity-0 mt-10 flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.6s' }}>
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
        <section className="max-w-6xl mx-auto px-6 mb-24">
          <div className="text-center mb-12">
            <h2 className="text-[10px] font-bold text-violet-400 tracking-[0.4em] uppercase mb-4">
              The Protocol
            </h2>
            <p className="text-xl md:text-3xl font-bold text-white tracking-tight leading-tight">
              Institutional grade data. <br />
              <span className="text-gray-500">Consumer simple access.</span>
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <div className="glass rounded-[2rem] border border-white/5 p-7 flex flex-col gap-6 hover:border-violet-500/40 hover:bg-violet-500/[0.03] transition-all duration-500 group relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-[50px] -mr-12 -mt-12 group-hover:bg-violet-500/20 transition-all duration-700"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xl group-hover:scale-110 group-hover:bg-violet-500 group-hover:text-white transition-all duration-700 shadow-xl shadow-violet-500/20">
                  1
                </div>
                <div className="text-[9px] font-black text-violet-400/40 uppercase tracking-[0.2em]">Step One</div>
              </div>
              <div className="space-y-3 relative z-10">
                <h3 className="text-lg font-bold text-white tracking-tight">Activation</h3>
                <p className="text-gray-400 leading-relaxed text-sm font-light">
                  Open <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline decoration-violet-500/30 underline-offset-4 font-bold">@sightwhale_bot</a> and run <span className="font-mono text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">/start</span> to sync your secure profile.
                </p>
              </div>
            </div>
            
            <div className="glass rounded-[2rem] border border-white/5 p-7 flex flex-col gap-6 hover:border-cyan-500/40 hover:bg-cyan-500/[0.03] transition-all duration-500 group relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-[50px] -mr-12 -mt-12 group-hover:bg-cyan-500/20 transition-all duration-700"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xl group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-700 shadow-xl shadow-cyan-500/20">
                  2
                </div>
                <div className="text-[9px] font-black text-cyan-400/40 uppercase tracking-[0.2em]">Step Two</div>
              </div>
              <div className="space-y-3 relative z-10">
                <h3 className="text-lg font-bold text-white tracking-tight">Intelligence</h3>
                <p className="text-gray-400 leading-relaxed text-sm font-light">
                  Select your <span className="font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">/subscribe</span> plan to unlock full whale transparency.
                </p>
              </div>
            </div>
            
            <div className="glass rounded-[2rem] border border-white/5 p-7 flex flex-col gap-6 hover:border-emerald-500/40 hover:bg-emerald-500/[0.03] transition-all duration-500 group relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[50px] -mr-12 -mt-12 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-700 shadow-xl shadow-emerald-500/20">
                  3
                </div>
                <div className="text-[9px] font-black text-emerald-400/40 uppercase tracking-[0.2em]">Step Three</div>
              </div>
              <div className="space-y-3 relative z-10">
                <h3 className="text-lg font-bold text-white tracking-tight">Execution</h3>
                <p className="text-gray-400 leading-relaxed text-sm font-light">
                  Deploy custom <span className="font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">/follow</span> rules to shadow specific market leaders.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="border-y border-white/5 bg-white/[0.01] backdrop-blur-sm py-16 mb-24 relative overflow-hidden">
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
                  <div className="text-4xl mb-1 group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">{item.icon}</div>
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
                  "Narratives are priced in before they become public"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-red-500/40 border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.2)] group-hover:bg-red-500 transition-all"></div>
                    <span className="text-base text-gray-400 group-hover:text-gray-200 transition-colors font-light">{item}</span>
                  </div>
                ))}
              </div>
              
              <div className="glass p-7 rounded-[1.5rem] border-l-4 border-l-violet-500 shadow-xl bg-violet-500/[0.02]">
                <p className="text-base text-gray-300 font-light leading-relaxed">
                  While the crowd follows the news, <strong className="text-white font-bold tracking-tight">smart money</strong> acts quietly — early, with size, and with verifiable conviction.
                </p>
              </div>
            </div>

            <div className="glass rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden group border-white/5 hover:border-cyan-500/30 transition-all duration-700 shadow-xl bg-white/[0.01]">
              <div className="absolute -top-20 -right-20 w-[250px] h-[250px] bg-cyan-500/10 rounded-full blur-[70px] group-hover:bg-cyan-500/20 transition-all duration-1000"></div>
              
              <div className="relative z-10">
                <h2 className="text-[10px] font-bold text-cyan-400 tracking-[0.4em] uppercase mb-5">The Solution</h2>
                <h3 className="text-xl md:text-3xl font-black text-white mb-6 tracking-tight leading-tight">We surface the <br /><span className="text-gradient-accent">Execution Truth</span>.</h3>
                
                <ul className="grid gap-3 mb-8">
                  {[
                    "Large trades that shift liquidity",
                    "Addresses with proven 80%+ accuracy",
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
        <section id="sample-signals" className="max-w-7xl mx-auto px-6 mb-24">
          <div className="text-center mb-12">
            <h2 className="section-title">The Intelligence Platform</h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">
              We monitor millions of data points to surface the only ones that matter.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 auto-rows-[minmax(280px,auto)]">
            
            {/* Feature 1: Alerts (Large Card) */}
            <div className="card md:col-span-2 md:row-span-2 relative overflow-hidden group p-7 md:p-8 flex flex-col justify-between shadow-[0_0_40px_rgba(0,0,0,0.4)] border-white/5 hover:border-violet-500/30 transition-all duration-700">
              <div className="absolute -right-20 -top-20 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px] group-hover:bg-violet-600/20 transition-all duration-1000"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">🐋</div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-white mb-0.5">Whale Alerts</h3>
                    <div className="text-violet-400 font-bold text-[9px] uppercase tracking-widest">Real-Time Execution</div>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-6 max-w-xl leading-relaxed font-light">
                  Direct notifications for high-conviction moves. We filter the noise so you only see the trades that shift the needle.
                </p>
                
                <div className="bg-[#030303] border border-white/10 rounded-2xl p-5 font-mono text-xs leading-relaxed relative overflow-hidden shadow-xl transform transition-all group-hover:translate-y-[-2px] group-hover:border-violet-500/40 duration-700">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 via-indigo-500 to-cyan-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  
                  <div className="flex justify-between text-[8px] text-gray-500 mb-3.5 border-b border-white/5 pb-2.5">
                    <span className="flex items-center gap-2 font-black tracking-[0.2em] text-violet-400"><span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span> LIVE SIGNAL</span>
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
                        <div className="h-full w-[84%] bg-gradient-to-r from-violet-600 to-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.4)] animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Smart Collections */}
            <div className="card relative overflow-hidden group p-7 flex flex-col justify-between border-white/5 hover:border-cyan-500/30 transition-all duration-700">
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-[80px] group-hover:bg-cyan-500/20 transition-all duration-700"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-700">💎</div>
                <h3 className="text-lg font-black text-white mb-2 tracking-tight">Smart Collections</h3>
                <p className="text-gray-400 text-xs leading-relaxed font-light">
                  Automated grouping of whales by strategy, win rate, and market bias.
                </p>
              </div>
              <div className="mt-5 space-y-2.5 relative z-10">
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-cyan-500/50"></div>
                </div>
                <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                  <span>Clustering Data</span>
                  <span className="text-cyan-400">Active</span>
                </div>
              </div>
            </div>

            {/* Feature 3: Portfolio Tracking */}
            <div className="card relative overflow-hidden group p-7 flex flex-col justify-between border-white/5 hover:border-emerald-500/30 transition-all duration-700">
              <div className="absolute -left-10 -top-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-all duration-700"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">📈</div>
                <h3 className="text-lg font-black text-white mb-2 tracking-tight">Alpha Tracking</h3>
                <p className="text-gray-400 text-xs leading-relaxed font-light">
                  Monitor the net positioning and historical performance of every whale.
                </p>
              </div>
              <div className="mt-5 flex gap-2 relative z-10">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-6 flex-1 bg-white/5 rounded-lg group-hover:bg-emerald-500/10 transition-colors" style={{ height: `${15 + Math.random() * 20}px` }}></div>
                ))}
              </div>
            </div>

            {/* Feature 4: Conviction */}
            <div className="card bg-gradient-to-br from-violet-950/40 to-black border-violet-500/20 group hover:shadow-[0_0_40px_rgba(139,92,246,0.1)] p-7 flex flex-col md:col-span-2">
              <div className="flex justify-between items-start mb-5">
                <h3 className="text-lg font-bold text-violet-100 tracking-tight">🔥 Conviction</h3>
                <div className="px-2 py-0.5 rounded-full text-[8px] bg-violet-500 text-white font-black tracking-widest shadow-lg">ELITE</div>
              </div>
              
              <ul className="grid md:grid-cols-2 gap-x-8 gap-y-3.5 text-xs text-gray-300 mb-6">
                {[
                  "Multiple smart money addresses align",
                  "Capital size is significant",
                  "Positions are held over time",
                  "Historically accurate whale entry"
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 group/li">
                    <span className="text-violet-400 font-mono font-bold group-hover/li:translate-x-1 transition-transform">0{i+1}</span>
                    <span className="text-gray-300 font-light">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-auto text-[10px] text-violet-200/50 border-t border-white/5 pt-4 font-medium">Reflecting <strong className="text-violet-400 font-bold text-glow">strong belief</strong>, not just speculation.</p>
            </div>

            {/* Feature 5: Performance (Fills the gap) */}
            <div className="card bg-gradient-to-br from-indigo-950/40 to-black border-indigo-500/20 group hover:shadow-[0_0_40px_rgba(99,102,241,0.1)] p-7 flex flex-col">
              <div className="flex justify-between items-start mb-5">
                <h3 className="text-lg font-bold text-indigo-100 tracking-tight">📈 Results</h3>
                <div className="px-2 py-0.5 rounded-full text-[8px] bg-indigo-500 text-white font-black tracking-widest shadow-lg">STATS</div>
              </div>
              
              <div className="space-y-3.5">
                {[
                  { label: "Win Rate", value: "72%", color: "text-emerald-400" },
                  { label: "Avg ROI", value: "+18.4%", color: "text-cyan-400" },
                  { label: "Total Signals", value: "1,240+", color: "text-indigo-400" }
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-gray-400 text-[9px] font-medium uppercase tracking-wider">{stat.label}</span>
                    <span className={`${stat.color} font-black text-base font-mono`}>{stat.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-auto text-[9px] text-gray-500 font-medium italic pt-4">Based on last 90 days of tracked signals.</p>
            </div>

            {/* Feature 6: Heatmap (Wide) */}
            <div className="card md:col-span-3 p-8 md:p-10 group hover:border-violet-500/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-white tracking-tight">
                    <span className="text-3xl group-hover:scale-110 transition-transform">📊</span> Market Heatmap
                  </h3>
                  <p className="text-gray-400 text-base mt-1 font-light">Perfect for research and market discovery.</p>
                </div>
                <div className="flex gap-2.5">
                  {['Volume', 'Flow', 'Trend'].map((tag) => (
                    <span key={tag} className="px-4 py-1.5 rounded-lg bg-white/5 text-[10px] font-bold text-gray-400 border border-white/5 group-hover:border-violet-500/20 transition-all">{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  { label: "Volume Ratio", value: "Whale vs Total", color: "text-cyan-400" },
                  { label: "Flow", value: "Net Inflow", color: "text-emerald-400" },
                  { label: "Trend", value: "Momentum", color: "text-violet-400" }
                ].map((stat, i) => (
                  <div key={i} className="p-6 bg-white/[0.02] rounded-[1.5rem] border border-white/5 hover:bg-white/[0.05] transition-all group/stat">
                    <div className="text-[9px] text-gray-500 mb-2.5 uppercase tracking-[0.2em] font-bold">{stat.label}</div>
                    <div className={`${stat.color} font-mono text-lg font-black group-hover/stat:scale-105 transition-transform`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-6 mb-24">
          <div className="text-center mb-16">
            <h2 className="text-[10px] font-bold text-violet-400 tracking-[0.4em] uppercase mb-5">Process</h2>
            <p className="text-2xl md:text-4xl font-black text-white tracking-tight mb-5">How It Works</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connecting Line */}
            <div className="hidden lg:block absolute top-1/3 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"></div>
            
            {[
              { title: "Ingest", desc: "Real-time trade & orderbook data" },
              { title: "Analyze", desc: "Identify abnormal capital movements" },
              { title: "Score", desc: "Historical accuracy, timing & impact" },
              { title: "Deliver", desc: "Signals via dashboard, Telegram & email" }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="glass rounded-[2rem] p-8 h-full border-white/5 group-hover:border-violet-500/30 transition-all duration-500 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center text-xl font-black mb-6 group-hover:bg-violet-500 group-hover:text-white transition-all duration-500 shadow-2xl">
                    {i + 1}
                  </div>
                  <h4 className="font-bold text-xl mb-3 text-white tracking-tight">{step.title}</h4>
                  <p className="text-gray-400 leading-relaxed text-sm font-light">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex items-center justify-center gap-4 text-gray-500 text-xs font-medium">
            <div className="flex -space-x-1.5">
              {[1,2,3].map(i => <div key={i} className="w-5 h-5 rounded-full border-2 border-[#050505] bg-gray-800"></div>)}
            </div>
            <span>Trusted by 2,000+ active traders</span>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="max-w-6xl mx-auto px-6 mb-24">
          <div className="glass rounded-[2.5rem] overflow-hidden p-10 md:p-16 relative bg-white/[0.01]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"></div>
            <div className="text-center mb-12">
              <h2 className="text-xl md:text-3xl font-black tracking-tight text-white mb-3">Why We’re Different</h2>
              <p className="text-gray-500 text-base">The transparency advantage in a black-box market.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-stretch">
              <div className="space-y-8 p-7 rounded-[2rem] bg-white/[0.02] border border-white/5">
                <p className="text-gray-600 font-black uppercase tracking-[0.3em] text-[10px]">Standard Tools</p>
                <ul className="space-y-6">
                  {["Predictive guessing", "Anonymous chat tips", "Black-box indicators", "Opaque track records"].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-gray-600 line-through text-base font-medium opacity-60">
                      <div className="w-5 h-5 rounded-full bg-gray-900 border border-white/5 flex items-center justify-center text-[8px]">✕</div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="relative p-8 rounded-[2.5rem] bg-violet-600/[0.03] border border-violet-500/20 shadow-2xl overflow-hidden group">
                <div className="absolute inset-0 bg-violet-500/5 blur-3xl group-hover:bg-violet-500/10 transition-colors"></div>
                <p className="text-violet-400 font-black uppercase tracking-[0.3em] text-[10px] mb-8 relative">Whale Intelligence</p>
                <ul className="space-y-6 relative">
                  {[
                    "Verified behavior tracking", 
                    "Full on-chain evidence", 
                    "Explainable logic engine", 
                    "Auditable historical performance"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-white text-lg font-bold tracking-tight">
                      <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-white text-[8px] shadow-[0_0_15px_rgba(139,92,246,0.5)]">✓</div>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-10 pt-6 border-t border-white/5 relative">
                  <p className="text-gray-400 text-xs italic font-light">"The most transparent data in DeFi."</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 mb-24 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none"></div>
          
          <div className="text-center mb-12 relative z-10">
            <h2 className="text-[10px] font-bold text-violet-400 tracking-[0.4em] uppercase mb-4">
              Pricing
            </h2>
            <p className="text-xl md:text-3xl font-black text-white tracking-tight mb-4 leading-tight">
              Institutional data. <br />
              <span className="text-gray-500">Retail simplicity.</span>
            </p>
            <p className="text-base text-gray-400 font-light max-w-2xl mx-auto">Choose the intelligence level that matches your market participation.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            
            {/* Free */}
            <div className="glass rounded-[2rem] h-full flex flex-col border-white/5 hover:border-white/10 p-7 group transition-all duration-500 bg-white/[0.01]">
              <h3 className="text-xs font-bold text-gray-500 tracking-tight uppercase mb-5">Free</h3>
              <div className="text-4xl font-black mb-5 text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">$0<span className="text-base font-normal text-gray-600 tracking-normal ml-1.5">/mo</span></div>
              <p className="text-gray-500 mb-8 text-sm font-light leading-relaxed">Basic access for casual observers.</p>
              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  "Global alerts (15m delay)",
                  "Public collections only",
                  "Limited whale profiles",
                  "Basic conviction data"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-400 font-medium text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <a href={FREE_CTA_URL} className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-center text-xs hover:bg-white/10 transition-all">Get started free</a>
            </div>

            {/* Pro - Most Popular */}
            <div className="glass rounded-[2.5rem] h-full flex flex-col border-violet-500/30 p-7 group relative overflow-hidden shadow-[0_0_80px_rgba(139,92,246,0.1)] bg-gradient-to-b from-violet-500/[0.08] to-transparent transform lg:scale-[1.02] z-10 transition-all duration-700">
              <div className="absolute top-0 right-0 px-5 py-1.5 bg-violet-500 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-bl-xl shadow-xl">Most Popular</div>
              <h3 className="text-xs font-bold text-violet-400 tracking-tight uppercase mb-5">Professional</h3>
              <div className="text-5xl font-black mb-5 text-white tracking-tighter drop-shadow-[0_0_20px_rgba(139,92,246,0.4)]">$29<span className="text-base font-normal text-gray-600 tracking-normal ml-1.5">/mo</span></div>
              <p className="text-gray-200 mb-8 text-sm font-light leading-relaxed">The gold standard for active traders.</p>
              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  "Real-time Whale Alerts",
                  "5 Smart Collections",
                  "100 /follow alert rules",
                  "Advanced conviction analysis",
                  "Full trade history & PnL",
                  "Priority Telegram support"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-100 font-bold text-xs">
                    <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <a href={CTA_URL} className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-black text-base text-center shadow-[0_15px_40px_rgba(139,92,246,0.2)] hover:bg-violet-500 transition-all transform hover:-translate-y-1">Get Pro Access</a>
            </div>

            {/* Institutional */}
            <div className="glass rounded-[2rem] h-full flex flex-col border-white/5 hover:border-white/10 p-7 group transition-all duration-500 bg-white/[0.01]">
              <h3 className="text-xs font-bold text-gray-500 tracking-tight uppercase mb-5">Institutional</h3>
              <div className="text-4xl font-black mb-5 text-white tracking-tighter drop-shadow-[0_0_20px_rgba(34,211,238,0.2)]">$129<span className="text-base font-normal text-gray-600 tracking-normal ml-1.5">/mo</span></div>
              <p className="text-gray-500 mb-8 text-sm font-light leading-relaxed">For funds and trading desks.</p>
              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  "20 Smart Collections",
                  "1,000 /follow alert rules",
                  "Direct API access (Websocket) - Soon",
                  "Custom clustering algorithms - Soon",
                  "Historical data exports - Soon",
                  "Dedicated account manager"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-400 font-medium text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <a href={CTA_URL} className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-center text-xs hover:bg-white/10 transition-all">Contact Sales</a>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
