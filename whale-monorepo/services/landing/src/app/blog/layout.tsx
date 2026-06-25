import type { Metadata } from 'next';

// All /blog routes are fully dynamic. Render PostgreSQL rejects
// connections from Vercel build servers so ISR pre-rendering fails.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Blog — Polymarket Strategies, Whale Insights & Prediction Markets',
    template: '%s · SightWhale Blog',
  },
  description:
    'In-depth articles on Polymarket trading strategies, whale tracking, prediction market theory, and SightWhale tools. New articles daily.',
  openGraph: {
    title: 'SightWhale Blog — Polymarket Strategies & Whale Insights',
    description:
      'In-depth articles on Polymarket trading strategies, whale tracking, and prediction market theory.',
    type: 'website',
    url: 'https://www.sightwhale.com/blog',
    siteName: 'SightWhale.com',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale Blog — Polymarket Strategies & Whale Insights',
    description:
      'In-depth articles on Polymarket trading strategies, whale tracking, and prediction market theory.',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://www.sightwhale.com'),
  alternates: { canonical: '/blog/en' },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">{children}</div>
    </div>
  );
}
