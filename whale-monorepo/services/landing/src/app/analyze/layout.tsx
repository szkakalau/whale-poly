import type { Metadata } from 'next';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

export const metadata: Metadata = {
  title: 'Free Polymarket Analysis Tool',
  description:
    'Analyze any Polymarket market with whale intelligence. Check smart money flow, odds trends, and market confidence before placing your bet.',
  openGraph: {
    title: 'Free Polymarket Analysis Tool — SightWhale',
    description:
      'Analyze any Polymarket market with whale intelligence. Check smart money flow, odds trends, and market confidence.',
    type: 'website',
    url: 'https://www.sightwhale.com/analyze',
    siteName: 'SightWhale.com',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Polymarket Analysis Tool — SightWhale',
    description:
      'Analyze any Polymarket market with whale intelligence. Check smart money flow and odds trends.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/analyze' },
};

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* SSR-rendered SEO content for crawlers (client component renders interactively for users) */}
      <section className="sr-only">
        <h2>Polymarket Whale Intelligence Analysis Tool</h2>
        <p>
          Search any Polymarket market by keyword or URL. See smart money flow,
          whale trade direction, odds trends, and wallet-level activity — all in one view.
          Free to use, no signup required.
        </p>
      </section>
      {children}
      <BreadcrumbListScript items={[{ name: 'Analyze', url: '/analyze' }]} />
    </>
  );
}
