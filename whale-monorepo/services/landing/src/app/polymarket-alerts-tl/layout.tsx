import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export const metadata = {
  title: { absolute: 'Polymarket Whale Alerts — SightWhale.com' },
  description:
    'Stop being exit liquidity on Polymarket. Real-time whale trade alerts from the top 1% most profitable wallets. 7-day risk-free trial with full refund guarantee.',
  openGraph: {
    title: 'SightWhale.com — Polymarket Whale Alerts',
    description:
      'Stop being exit liquidity on Polymarket. Real-time whale trade alerts from the top 1% most profitable wallets. 7-day risk-free trial with full refund guarantee.',
    type: 'website',
    url: 'https://www.sightwhale.com/polymarket-alerts-tl',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale.com — Polymarket Whale Alerts',
    description:
      'Stop being exit liquidity on Polymarket. Real-time whale trade alerts from the top 1% most profitable wallets. 7-day risk-free trial with full refund guarantee.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: '/polymarket-alerts-tl',
  },
};

export default function PolymarketAlertsTlLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <BreadcrumbListScript items={[{ name: 'Polymarket Whale Alerts', url: '/polymarket-alerts-tl' }]} />
    </>
  );
}
