const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/sightwhale_bot";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#020202] py-20 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <div className="w-4 h-4 rounded-full bg-white/20 animate-pulse"></div>
              </div>
              <span className="font-bold text-white text-xl tracking-tight">Sight Whale</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm font-light">
              The leading intelligence layer for Polymarket. We track historically profitable whale behavior and deliver real-time alerts to help you stay ahead of the crowd.
            </p>
          </div>

          {/* Product Column */}
          <div className="space-y-6">
            <h4 className="text-white font-bold text-sm tracking-widest uppercase">Platform</h4>
            <ul className="space-y-4">
              <li><a href="/backtesting" className="text-gray-400 hover:text-violet-400 text-sm transition-colors">Whale Performance</a></li>
              <li><a href="/conviction" className="text-gray-400 hover:text-violet-400 text-sm transition-colors">Conviction Analysis</a></li>
              <li><a href="/blog" className="text-gray-400 hover:text-violet-400 text-sm transition-colors">Intelligence Blog</a></li>
              <li><a href="/smart-collections" className="text-gray-400 hover:text-violet-400 text-sm transition-colors">Smart Collections</a></li>
            </ul>
          </div>

          {/* Community Column */}
          <div className="space-y-6">
            <h4 className="text-white font-bold text-sm tracking-widest uppercase">Connect</h4>
            <div className="flex flex-col gap-4">
              <a 
                href={TELEGRAM_BOT_URL} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3 text-gray-400 hover:text-white transition-all group"
                aria-label="Join our Telegram Bot for Whale Alerts"
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-violet-500/20 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z"/></svg>
                </div>
                <span className="text-sm">Telegram Bot</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-gray-500 text-xs font-light">
            © {new Date().getFullYear()} Sight Whale. Built for the next generation of prediction market traders.
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">Privacy Policy</a>
            <a href="#" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
