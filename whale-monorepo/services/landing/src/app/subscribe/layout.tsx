import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { absolute: 'Subscribe - SightWhale.com' },
  description:
    'Unlock real-time Polymarket whale trade alerts with Telegram delivery, verified performance history, and a full first-month refund guarantee.',
  openGraph: {
    title: 'Subscribe - SightWhale.com',
    description:
      'Unlock real-time Polymarket whale trade alerts with Telegram delivery, verified performance history, and a full first-month refund guarantee.',
    type: 'website',
    url: 'https://www.sightwhale.com/subscribe',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Subscribe - SightWhale.com',
    description:
      'Unlock real-time Polymarket whale trade alerts with Telegram delivery, verified performance history, and a full first-month refund guarantee.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/subscribe',
  },
};

export default function SubscribeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
