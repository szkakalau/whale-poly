import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const CTA_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || "#pricing";

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
        <section className="relative px-6 max-w-7xl mx-auto text-center mb-40 pt-10">
          <div className="animate-fade-in opacity-0" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 border border-violet-500/30 text-violet-200 text-sm hover:border-violet-400/50 transition-colors cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Tracking <span className="font-semibold text-white">$1.2B+</span> in Prediction Market Volume
            </div>
          </div>

          <h1 className="animate-fade-in opacity-0 text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-[1.1] md:leading-[1.1]" style={{ animationDelay: '0.2s' }}>
            Follow the <span className="text-gradient relative inline-block">
              Smart Money
              <span className="absolute -inset-1 blur-2xl bg-violet-500/20 -z-10"></span>
            </span>.<br />
            Not the <span className="text-transparent bg-clip-text bg-gradient-to-b from-gray-500 to-gray-700 decoration-gray-700 line-through decoration-4 decoration-wavy">Noise</span>.
          </h1>
          
          <p className="animate-fade-in opacity-0 mt-8 max-w-2xl mx-auto text-xl md:text-2xl text-gray-400 leading-relaxed font-light" style={{ animationDelay: '0.3s' }}>
            Real-time intelligence on whale activity in Polymarket. We track what large, historically profitable players are <em className="text-violet-300 not-italic font-medium">actually betting</em> — so you don’t have to guess.
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

          <div className="animate-fade-in opacity-0 mt-10 flex flex-wrap justify-center gap-6 text-sm text-gray-500 font-medium" style={{ animationDelay: '0.5s' }}>
            <Link href="/backtesting" className="flex items-center gap-1 hover:text-violet-400 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              View Backtesting Results
            </Link>
            <span className="hidden sm:inline text-gray-700">•</span>
            <Link href="/conviction" className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              View Conviction Case Studies
            </Link>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="border-y border-white/5 bg-white/[0.02] backdrop-blur-sm py-20 mb-32">
          <div className="max-w-6xl mx-auto px-6">
            <blockquote className="text-3xl md:text-4xl font-light text-center text-gray-300 italic mb-16 leading-tight">
              “We don’t predict outcomes. <br className="hidden md:block" />We <span className="text-white font-normal not-italic">track capital</span>.”
            </blockquote>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: "⚡️", title: "Real Data", desc: "Built on real on-chain & orderbook data" },
                { icon: "🛡", title: "No Hype", desc: "No anonymous tips, no hype calls" },
                { icon: "✅", title: "Verifiable", desc: "Every signal is verifiable & reviewable" }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl hover:bg-white/5 transition-colors duration-300">
                  <div className="text-4xl mb-2">{item.icon}</div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <div className="text-gray-400 font-medium">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* THE PROBLEM & SOLUTION GRID */}
        <section className="max-w-7xl mx-auto px-6 mb-40">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <h2 className="section-title text-left">
                Prediction markets are hard because of <em className="text-red-400 not-italic bg-red-500/10 px-2 rounded">noise</em>.
              </h2>
              
              <div className="space-y-6">
                {[
                  "Headlines move faster than facts",
                  "Retail sentiment is loud and misleading",
                  "By the time a narrative is obvious, price already moved"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-transparent hover:border-red-500/20 hover:bg-red-500/5 transition-all">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    <span className="text-lg text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              
              <div className="glass p-6 rounded-xl border-l-4 border-l-violet-500">
                <p className="text-xl text-gray-200 font-light">
                  Meanwhile, <strong className="text-violet-300 font-semibold">smart money</strong> acts quietly — early, consistently, and with size.
                </p>
              </div>
            </div>

            <div className="glass rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden group border-white/10 hover:border-cyan-500/30 transition-all duration-500">
              <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] group-hover:bg-cyan-500/20 transition-all duration-500"></div>
              <div className="absolute bottom-0 left-0 w-60 h-60 bg-violet-500/10 rounded-full blur-[80px] group-hover:bg-violet-500/20 transition-all duration-500"></div>
              
              <div className="relative z-10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">The Solution</h2>
                <h3 className="text-4xl md:text-5xl font-bold text-white mb-8">We surface <span className="text-gradient-accent">Truth</span>.</h3>
                
                <p className="text-lg text-gray-400 mb-8">Polymarket Whale Intelligence monitors:</p>
                <ul className="grid gap-4 mb-10">
                  {[
                    "Large trades that move markets",
                    "Addresses with strong historical accuracy",
                    "Repeated accumulation patterns",
                    "Capital flows before major price moves"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-gray-200 bg-white/5 p-3 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-base text-gray-500 border-t border-white/10 pt-6">
                  You see <span className="text-white font-medium">who</span> is betting, <span className="text-white font-medium">how much</span>, <span className="text-white font-medium">when</span>, and <span className="text-white font-medium">with what conviction</span>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES BENTO GRID */}
        <section id="sample-signals" className="max-w-7xl mx-auto px-6 mb-40">
          <div className="text-center mb-20">
            <h2 className="section-title">Intelligence Platform</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Everything you need to track the flow of funds in real-time.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]">
            
            {/* Feature 1: Alerts (Large Card) */}
            <div className="card md:col-span-2 md:row-span-2 relative overflow-hidden group">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-violet-600/20 rounded-full blur-[80px] group-hover:bg-violet-600/30 transition-all duration-500"></div>
              
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-violet-500/20 rounded-lg text-2xl">🐋</div>
                  <h3 className="text-2xl font-bold">Whale Alerts</h3>
                </div>
                <p className="text-gray-400 mb-8 max-w-md">Real-time notifications sent directly to your device when unusually large or aggressive trades hit the market.</p>
                
                <div className="mt-auto bg-[#0a0a0a] border border-white/10 rounded-xl p-6 font-mono text-sm leading-relaxed relative overflow-hidden shadow-2xl transform transition-transform group-hover:scale-[1.02] duration-300">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-cyan-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex justify-between text-xs text-gray-500 mb-4 border-b border-white/5 pb-2">
                    <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> LIVE SIGNAL</span>
                    <span>JUST NOW</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 relative z-10">
                    <span className="text-gray-500">Market</span>
                    <span className="text-white font-semibold truncate">US Election – Trump Wins</span>
                    
                    <span className="text-gray-500">Outcome</span>
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded w-fit">YES</span>
                    
                    <span className="text-gray-500">Action</span>
                    <span className="text-emerald-400 font-bold">BUY (Aggressive)</span>
                    
                    <span className="text-gray-500">Size</span>
                    <span className="text-white">$182,400</span>
                    
                    <span className="text-gray-500">Avg Price</span>
                    <span className="text-white">0.41</span>
                    
                    <span className="text-gray-500">Whale Score</span>
                    <span className="text-violet-400 font-bold flex items-center gap-1">
                      7.8 / 10
                      <div className="h-1 w-12 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full w-[78%] bg-violet-400"></div>
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Watchlist */}
            <div className="card flex flex-col justify-between group hover:border-cyan-500/30">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-cyan-500/20 rounded-lg text-xl">🧠</div>
                  <h3 className="text-xl font-bold">Smart Watchlist</h3>
                </div>
                <p className="text-gray-400 text-sm mb-6">We track addresses that consistently outperform the market.</p>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>Total capital deployed</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>Historical win rate</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>Current active positions</li>
                </ul>
              </div>
            </div>

            {/* Feature 3: Conviction */}
            <div className="card bg-gradient-to-br from-violet-900/40 to-black border-violet-500/30 group hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-violet-200">🔥 Conviction</h3>
                <div className="px-2 py-0.5 rounded text-[10px] bg-violet-500 text-white font-bold tracking-wider">ELITE</div>
              </div>
              
              <ul className="space-y-4 text-sm text-gray-300 mb-6">
                {[
                  "Multiple smart money addresses align",
                  "Capital size is significant",
                  "Positions are held over time"
                ].map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-violet-400 font-mono">0{i+1}</span>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-auto text-xs text-violet-200/70 border-t border-white/5 pt-4">Reflecting <strong>strong belief</strong>, not just speculation.</p>
            </div>

            {/* Feature 4: Heatmap (Wide) */}
            <div className="card md:col-span-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-2xl">📊</span> Market Heatmap
                  </h3>
                  <p className="text-gray-400 text-sm">Perfect for research and market discovery.</p>
                </div>
                <div className="flex gap-2">
                  {['Volume', 'Flow', 'Trend'].map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-400 border border-white/5">{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Volume Ratio", value: "Whale vs Total", color: "text-cyan-400" },
                  { label: "Flow", value: "Net Inflow", color: "text-emerald-400" },
                  { label: "Trend", value: "Momentum", color: "text-violet-400" }
                ].map((stat, i) => (
                  <div key={i} className="p-4 bg-white/[0.03] rounded-xl border border-white/5 hover:bg-white/[0.06] transition-colors">
                    <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{stat.label}</div>
                    <div className={`${stat.color} font-mono text-lg font-bold`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-6 mb-40">
          <h2 className="section-title text-center mb-20">How It Works</h2>
          <div className="grid sm:grid-cols-4 gap-8 relative">
            {/* Connecting Line */}
            <div className="hidden sm:block absolute top-10 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>
            
            {[
              { title: "Ingest", desc: "Real-time trade & orderbook data" },
              { title: "Analyze", desc: "Identify abnormal capital movements" },
              { title: "Score", desc: "Historical accuracy, timing & impact" },
              { title: "Deliver", desc: "Signals via dashboard, Telegram & email" }
            ].map((step, i) => (
              <div key={i} className="relative pt-4 text-center group">
                <div className="w-20 h-20 mx-auto bg-[#030014] border border-violet-500/30 rounded-full flex items-center justify-center text-2xl font-bold text-violet-400 relative z-10 mb-6 shadow-[0_0_30px_rgba(139,92,246,0.1)] group-hover:scale-110 group-hover:border-violet-500 group-hover:shadow-[0_0_40px_rgba(139,92,246,0.3)] transition-all duration-300">
                  {i + 1}
                </div>
                <h4 className="font-bold text-xl mb-3 text-white">{step.title}</h4>
                <p className="text-sm text-gray-400 leading-relaxed px-2">{step.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-16 text-gray-500 text-sm flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Every signal is logged. Every score is auditable.
          </p>
        </section>

        {/* COMPARISON */}
        <section className="max-w-5xl mx-auto px-6 mb-40">
          <div className="glass rounded-3xl overflow-hidden p-8 md:p-12">
            <h2 className="section-title text-center mb-12">Why We’re Different</h2>
            
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-gray-500 font-medium mb-6 uppercase tracking-widest text-sm">Others</h3>
                <ul className="space-y-6">
                  {["Predict outcomes", "Anonymous tips", "Black-box calls", "Cherry-picked wins"].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-gray-500 decoration-gray-700 line-through">
                      <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-gray-600 text-xs">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/5 rounded-2xl -m-6 blur-xl"></div>
                <h3 className="text-white font-bold mb-6 uppercase tracking-widest text-sm relative">Us (Whale Intelligence)</h3>
                <ul className="space-y-6 relative">
                  {[
                    "Track behavior", 
                    "On-chain evidence", 
                    "Explainable signals", 
                    "Full history & stats"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-white text-lg font-medium">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 flex items-center justify-center text-white text-xs shadow-lg">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="text-center mb-20">
            <h2 className="section-title">Simple Pricing</h2>
            <p className="text-gray-400">Start tracking smart money today.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* Free */}
            <div className="card h-full flex flex-col border-white/5 hover:border-white/10">
              <h3 className="text-xl font-semibold text-gray-300">Free</h3>
              <div className="text-4xl font-bold mt-4 mb-6">$0<span className="text-sm font-normal text-gray-500">/mo</span></div>
              <p className="text-sm text-gray-500 mb-6">Basic access for casual observers.</p>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-gray-400"><span className="text-gray-600">○</span> Delayed whale alerts</li>
                <li className="flex items-center gap-3 text-sm text-gray-400"><span className="text-gray-600">○</span> Market heatmap (limited)</li>
                <li className="flex items-center gap-3 text-sm text-gray-400"><span className="text-gray-600">○</span> Sample signal history</li>
              </ul>
              <a href={CTA_URL} className="btn-secondary w-full">Get started free</a>
            </div>

            {/* Pro - Highlighted */}
            <div className="card h-full flex flex-col relative border-violet-500/50 bg-violet-900/10 shadow-[0_0_50px_rgba(139,92,246,0.15)] transform md:-translate-y-4 z-10 hover:scale-[1.02]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg animate-pulse-slow">
                  Most Popular
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white">Pro</h3>
              <div className="text-5xl font-bold mt-4 mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-violet-200">
                $39<span className="text-lg font-normal text-gray-400">/mo</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">For serious traders who want an edge.</p>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-white"><span className="text-cyan-400">✓</span> Real-time whale alerts</li>
                <li className="flex items-center gap-3 text-sm text-white"><span className="text-cyan-400">✓</span> Address profiles</li>
                <li className="flex items-center gap-3 text-sm text-white"><span className="text-cyan-400">✓</span> Full market heatmap</li>
                <li className="flex items-center gap-3 text-sm text-white"><span className="text-cyan-400">✓</span> 30-day history</li>
              </ul>
              <a href={CTA_URL} className="btn-primary w-full shadow-lg text-lg py-4">Get Pro Access</a>
            </div>

            {/* Elite */}
            <div className="card h-full flex flex-col border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
              <h3 className="text-xl font-semibold text-violet-200">Elite</h3>
              <div className="text-4xl font-bold mt-4 mb-6">$129<span className="text-sm font-normal text-gray-500">/mo</span></div>
              <p className="text-sm text-gray-500 mb-6">Full institutional-grade access.</p>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-gray-300"><span className="text-violet-400">★</span> Everything in Pro</li>
                <li className="flex items-center gap-3 text-sm text-gray-300"><span className="text-violet-400">★</span> Conviction signals</li>
                <li className="flex items-center gap-3 text-sm text-gray-300"><span className="text-violet-400">★</span> Unlimited history</li>
                <li className="flex items-center gap-3 text-sm text-gray-300"><span className="text-violet-400">★</span> Priority support</li>
              </ul>
              <a href={CTA_URL} className="btn-secondary w-full border-violet-500/30 hover:bg-violet-500/10">Get Elite</a>
            </div>

          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
