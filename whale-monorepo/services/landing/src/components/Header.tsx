import Link from 'next/link';

const CTA_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || "/subscribe";
const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/sightwhale_bot";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav transition-all duration-300">
      <div className="mx-auto max-w-7xl px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" title="Sight Whale Home">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-400 shadow-lg shadow-violet-500/20">
            <span className="absolute inset-0 rounded-lg bg-white/20 animate-pulse"></span>
          </div>
          <span className="font-bold tracking-tight text-lg text-white">Whale Intelligence</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-7">
          <Link href="/backtesting" className="text-[13px] font-medium text-gray-300 hover:text-white transition-colors">
            Performance
          </Link>
          <Link href="/conviction" className="text-[13px] font-medium text-gray-300 hover:text-white transition-colors">
            Conviction
          </Link>
          <Link href="/blog" className="text-[13px] font-medium text-gray-300 hover:text-white transition-colors">
            Blog
          </Link>
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z"/></svg>
            Telegram
          </a>
        </nav>

        <a href={CTA_URL} className="btn-primary text-xs px-4 py-1.5 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.4)]">
          Get Alerts
        </a>
      </div>
    </header>
  );
}
