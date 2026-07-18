import type { Metadata } from 'next';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

const DATE_MODIFIED = '2026-07-18';

export const metadata: Metadata = {
  title: 'Volume-Weighted Analysis — Whale Flow Detection · SightWhale',
  description:
    'Discover prediction markets with significant whale volume divergence. Sort by volume, divergence strength, and track smart money flow in real time.',
  openGraph: {
    title: 'Volume-Weighted Analysis — Whale Flow Detection · SightWhale',
    description:
      'Discover prediction markets with significant whale volume divergence. Track smart money flow in real time.',
    type: 'website',
    url: 'https://www.sightwhale.com/volume-analysis',
    siteName: 'SightWhale',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Volume-Weighted Analysis — Whale Flow Detection · SightWhale',
    description:
      'Discover prediction markets with significant whale volume divergence.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/volume-analysis' },
  other: { 'date-modified': DATE_MODIFIED },
};

export default function VolumeAnalysisLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BreadcrumbListScript items={[{ name: 'Volume Analysis', url: '/volume-analysis' }]} />
    </>
  );
}
