import type { ReactNode } from 'react';
import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#030303',
};

export const metadata = {
  title: 'Polymarket Whale Alerts — SightWhale',
  description:
    'Know what whales bet before the market reacts. Track $10k+ Polymarket bets in real time — founding member pricing.',
  openGraph: {
    title: 'SightWhale — Polymarket Whale Alerts',
    description:
      'Know what whales bet before the market reacts. Real-time whale alerts for Polymarket.',
    type: 'website',
    url: 'https://www.sightwhale.com/polymarket-alerts-tl',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale — Polymarket Whale Alerts',
    description:
      'Know what whales bet before the market reacts. Real-time alerts — $29/mo.',
  },
  alternates: {
    canonical: '/polymarket-alerts-tl',
  },
};

export default function PolymarketAlertsTlLayout({ children }: { children: ReactNode }) {
  return children;
}
