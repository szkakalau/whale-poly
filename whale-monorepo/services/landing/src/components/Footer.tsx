import Link from 'next/link';
import { WhaleLogo } from './WhaleLogo';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/sightwhale_bot";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12 sm:py-20 relative z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom,0))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 sm:gap-12 mb-12 sm:mb-16">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <WhaleLogo className="h-9 w-9 text-foreground drop-shadow-[0_0_14px_rgba(91,140,255,0.32)]" />
              <span className="font-bold text-foreground text-xl tracking-tight font-display">Sight Whale</span>
            </div>
            <p className="text-muted text-sm leading-relaxed max-w-sm font-light">
              The leading intelligence layer for Polymarket. We track historically profitable whale behavior and deliver real-time alerts to help you stay ahead of the crowd.
            </p>
          </div>

          {/* Product Column */}
          <div className="space-y-6">
            <p className="text-foreground font-bold text-sm tracking-widest uppercase">Platform</p>
            <ul className="space-y-4">
              <li><Link href="/backtesting" className="text-muted hover:text-accent-hover text-sm transition-colors py-2 block min-h-[44px] flex items-center">Whale Performance</Link></li>
              <li><Link href="/conviction" className="text-muted hover:text-accent-hover text-sm transition-colors py-2 block min-h-[44px] flex items-center">Conviction Analysis</Link></li>
              <li><Link href="/blog" className="text-muted hover:text-accent-hover text-sm transition-colors py-2 block min-h-[44px] flex items-center">Intelligence Blog</Link></li>
              <li><Link href="/smart-collections" className="text-muted hover:text-accent-hover text-sm transition-colors py-2 block min-h-[44px] flex items-center">Smart Collections</Link></li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-6">
            <p className="text-foreground font-bold text-sm tracking-widest uppercase">Company</p>
            <div className="flex flex-col gap-3">
              <Link href="/about" className="text-muted hover:text-accent-hover text-sm transition-colors">
                About
              </Link>
              <Link href="/methodology" className="text-muted hover:text-accent-hover text-sm transition-colors">
                Methodology
              </Link>
              <Link href="/editorial-policy" className="text-muted hover:text-accent-hover text-sm transition-colors">
                Editorial Policy
              </Link>
              <Link href="/contact" className="text-muted hover:text-accent-hover text-sm transition-colors">
                Contact
              </Link>
              <Link href="/disclosures" className="text-muted hover:text-accent-hover text-sm transition-colors">
                Disclosures
              </Link>
              <Link href="/security" className="text-muted hover:text-accent-hover text-sm transition-colors">
                Security
              </Link>
              <a 
                href={TELEGRAM_BOT_URL} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-3 flex items-center gap-3 text-muted hover:text-foreground transition-all group"
                aria-label="Join our Telegram Bot for Whale Alerts"
              >
                <div className="p-2 rounded-lg bg-surface group-hover:bg-accent/15 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z"/></svg>
                </div>
                <span className="text-sm">Telegram Bot</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border-muted flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-subtle text-xs font-light">
            © {new Date().getFullYear()} Sight Whale. Built for the next generation of prediction market traders.
          </div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-subtle hover:text-muted text-xs transition-colors">Privacy</Link>
            <Link href="/terms" className="text-subtle hover:text-muted text-xs transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
