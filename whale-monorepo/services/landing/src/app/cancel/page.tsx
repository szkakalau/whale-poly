import Link from 'next/link';

export const metadata = {
  title: { absolute: 'Checkout Canceled - SightWhale.com' },
  description:
    'Checkout was canceled — no charges were made. Return to SightWhale anytime to subscribe for real-time Polymarket whale alerts.',
  openGraph: {
    title: 'Checkout Canceled - SightWhale.com',
    description:
      'Checkout was canceled — no charges were made. Return to SightWhale anytime to subscribe for real-time Polymarket whale alerts.',
    type: 'website',
    url: 'https://www.sightwhale.com/cancel',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Checkout Canceled - SightWhale.com',
    description:
      'Checkout was canceled — no charges were made. Return to SightWhale anytime to subscribe for real-time Polymarket whale alerts.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/cancel',
  },
};

export default function CancelPage() {
  return (
    <div className="min-h-screen text-foreground selection:bg-accent-primary/30 overflow-hidden bg-background">
      <main className="mx-auto max-w-2xl px-6 py-32 relative">
        <h1 className="text-4xl font-bold mb-6 text-white">Checkout canceled</h1>
        <p className="text-gray-300 mb-10">
          No charges were made. You can try again anytime.
        </p>
        <div className="glass rounded-2xl border border-white/10 p-6 space-y-4 text-gray-300">
          <Link href="/subscribe" className="btn-primary inline-block">Try again</Link>
          <div className="text-sm text-gray-500">
            <Link href="/" className="underline hover:text-gray-300">Back to home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
