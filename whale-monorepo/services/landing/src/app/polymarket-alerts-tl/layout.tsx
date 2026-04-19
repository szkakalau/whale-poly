import type { ReactNode } from 'react';

export const metadata = {
  title: 'Polymarket Whale Alerts — SightWhale',
  description:
    'Follow Polymarket whales in real time. Get instant alerts when smart money places big bets.',
  openGraph: {
    title: 'SightWhale — Polymarket Whale Alerts',
    description:
      'Get instant alerts when smart money places big bets. Stop trading blind.',
    type: 'website',
    url: 'https://www.sightwhale.com/polymarket-alerts-tl',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale — Polymarket Whale Alerts',
    description:
      'Get instant alerts when smart money places big bets. Stop trading blind.',
  },
  alternates: {
    canonical: '/polymarket-alerts-tl',
  },
};

export default function PolymarketAlertsTlLayout({ children }: { children: ReactNode }) {
  return children;
}
