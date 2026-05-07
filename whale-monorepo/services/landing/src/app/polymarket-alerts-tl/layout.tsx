import type { ReactNode } from 'react';
import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export const metadata = {
  title: 'Polymarket Whale Alerts — SightWhale',
  description:
    'Stop being exit liquidity on Polymarket. Whale-sized bets in real time — 7-day risk-free trial, full refund.',
  openGraph: {
    title: 'SightWhale — Polymarket Whale Alerts',
    description:
      'See whale-sized bets in real time. 7-day risk-free trial — cancel anytime.',
    type: 'website',
    url: 'https://www.sightwhale.com/polymarket-alerts-tl',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale — Polymarket Whale Alerts',
    description:
      'Whale alerts for Polymarket. 7-day risk-free trial.',
  },
  alternates: {
    canonical: '/polymarket-alerts-tl',
  },
};

export default function PolymarketAlertsTlLayout({ children }: { children: ReactNode }) {
  return children;
}
