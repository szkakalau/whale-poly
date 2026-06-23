'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WhaleLogo } from './WhaleLogo';
import { Menu, X } from 'lucide-react';
import { getLoginUrl, getDashboardUrl } from '@/lib/external-urls';
import type { AuthUser } from '@/lib/auth';

const LOGIN_URL = getLoginUrl();
const DASHBOARD_URL = getDashboardUrl();

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/analyze', label: 'Analyze' },
  { href: '/history', label: 'History' },
  { href: '/blog', label: 'Blog' },
  { href: '/pricing', label: 'Pricing' },
];

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, Math.min(3, name.length))}***@${domain}`;
}

export default function Header({ user }: { user: AuthUser | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const accountLink = user ? (
    <Link
      href={DASHBOARD_URL}
      className="text-[13px] font-medium text-accent hover:text-accent-hover transition-colors"
      title={user.email}
    >
      {maskEmail(user.email)}
    </Link>
  ) : (
    <a
      href={LOGIN_URL}
      className="text-[13px] font-medium text-muted hover:text-foreground transition-colors"
    >
      Log in
    </a>
  );

  const ctaButton = user ? (
    <Link
      href={DASHBOARD_URL}
      className="btn-primary text-xs px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center"
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/pricing"
      className="btn-primary text-xs px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center"
    >
      Get real-time
    </Link>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 header-nav transition-colors duration-300 pt-[env(safe-area-inset-top,0)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-5 h-14 min-h-[3.5rem] flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0" title="SightWhale Home">
          <WhaleLogo className="h-8 w-8 flex-shrink-0 text-accent" />
          <span className="font-semibold tracking-tight text-base sm:text-lg truncate font-display">
            SightWhale
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="text-[13px] font-medium text-muted hover:text-foreground transition-colors">
              {label}
            </Link>
          ))}
          {accountLink}
          {ctaButton}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0 md:hidden">
          {user ? (
            <Link
              href={DASHBOARD_URL}
              className="btn-primary text-xs px-4 py-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            >
              Account
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="btn-primary text-xs px-4 py-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            >
              Pricing
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="p-2.5 -mr-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div
        className={`md:hidden fixed inset-0 top-14 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-200 ${
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
          {user ? (
            <Link
              href={DASHBOARD_URL}
              onClick={() => setMobileOpen(false)}
              className="py-3.5 px-4 rounded-xl text-[15px] font-medium text-accent hover:text-foreground hover:bg-surface-hover active:bg-surface transition-colors min-h-[48px] flex items-center"
            >
              Dashboard · {maskEmail(user.email)}
            </Link>
          ) : (
            <a
              href={LOGIN_URL}
              onClick={() => setMobileOpen(false)}
              className="py-3.5 px-4 rounded-xl text-[15px] font-medium text-muted hover:text-foreground hover:bg-surface-hover active:bg-surface transition-colors min-h-[48px] flex items-center"
            >
              Log in
            </a>
          )}
          <Link
            href={user ? DASHBOARD_URL : '/pricing'}
            onClick={() => setMobileOpen(false)}
            className="mt-4 btn-primary text-sm px-6 py-3.5 min-h-[48px] flex items-center justify-center"
          >
            {user ? 'Dashboard' : 'Get real-time signals'}
          </Link>
        </nav>
      </div>
    </header>
  );
}
