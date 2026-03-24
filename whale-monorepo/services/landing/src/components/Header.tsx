'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WhaleLogo } from './WhaleLogo';
import { Menu, X } from 'lucide-react';

const CTA_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || "/subscribe";
const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/sightwhale_bot";
const TELEGRAM_DEEP_LINK_HEADER = `${TELEGRAM_BOT_URL}?start=site_header`;

const navLinks = [
  { href: '/backtesting', label: 'Performance' },
  { href: '/conviction', label: 'Conviction' },
  { href: '/smart-money', label: 'Smart Money' },
  { href: '/follow', label: 'My' },
  { href: '/blog', label: 'Blog' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav transition-all duration-300 pt-[env(safe-area-inset-top,0)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-5 h-14 min-h-[3.5rem] flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0" title="Sight Whale Home">
          <WhaleLogo className="h-8 w-8 flex-shrink-0 text-foreground drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]" />
          <span className="font-bold tracking-tight text-base sm:text-lg text-foreground truncate font-display">
            <span className="md:hidden">Sight Whale</span>
            <span className="hidden md:inline">Polymarket Whale Intelligence</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="text-[13px] font-medium text-muted hover:text-foreground transition-colors">
              {label}
            </Link>
          ))}
          <a href={TELEGRAM_DEEP_LINK_HEADER} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-muted hover:text-foreground transition-colors flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z"/></svg>
            Telegram
          </a>
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={CTA_URL} className="btn-primary text-xs px-4 py-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center shadow-[0_0_16px_rgba(56,189,248,0.22)] hover:shadow-[0_0_26px_rgba(56,189,248,0.38)] hidden sm:inline-flex">
            Get Alerts
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden p-2.5 -mr-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={`md:hidden fixed inset-0 top-14 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />
      <div
        className={`md:hidden fixed top-14 left-0 right-0 bottom-0 z-40 overflow-y-auto bg-background border-t border-border transition-transform duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
      >
        <nav className="flex flex-col p-4 gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="py-3.5 px-4 rounded-xl text-[15px] font-medium text-muted hover:text-foreground hover:bg-surface-hover active:bg-surface transition-colors min-h-[48px] flex items-center"
            >
              {label}
            </Link>
          ))}
          <a
            href={TELEGRAM_DEEP_LINK_HEADER}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="py-3.5 px-4 rounded-xl text-[15px] font-medium text-muted hover:text-foreground hover:bg-surface-hover active:bg-surface transition-colors min-h-[48px] flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z"/></svg>
            Telegram
          </a>
          <a
            href={CTA_URL}
            onClick={() => setMobileOpen(false)}
            className="mt-4 btn-primary text-sm px-6 py-3.5 min-h-[48px] flex items-center justify-center rounded-xl"
          >
            Get Alerts
          </a>
        </nav>
      </div>
    </header>
  );
}
