import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export const metadata = {
  title: { absolute: 'Payment Successful - SightWhale.com' },
  description:
    'Payment received — your SightWhale subscription will activate shortly. Get real-time Polymarket whale trade alerts and Telegram notifications.',
  openGraph: {
    title: 'Payment Successful - SightWhale.com',
    description:
      'Payment received — your SightWhale subscription will activate shortly. Get real-time Polymarket whale trade alerts and Telegram notifications.',
    type: 'website',
    url: 'https://www.sightwhale.com/success',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Payment Successful - SightWhale.com',
    description:
      'Payment received — your SightWhale subscription will activate shortly. Get real-time Polymarket whale trade alerts and Telegram notifications.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/success',
  },
};

export default function SuccessPage() {
  return (
    <div className="min-h-screen text-foreground selection:bg-accent-primary/30 overflow-hidden bg-background">
      <main className="mx-auto max-w-2xl px-6 py-32 relative">
        <Suspense fallback={<SuccessFallback />}>
          <SuccessClient />
        </Suspense>
      </main>
    </div>
  );
}

function SuccessFallback() {
  return (
    <>
      <h1 className="mb-6 text-4xl font-bold text-white">Payment received</h1>
      <p className="mb-10 text-gray-300">
        Payment completed. Your subscription will be activated automatically after processing.
      </p>
      <div className="glass space-y-4 rounded-2xl border border-white/10 p-6 text-gray-300">
        <p>
          Open Telegram bot and run <span className="font-mono">/status</span> to confirm activation.
        </p>
        <p>If it&apos;s not active yet, wait 1-2 minutes and try again.</p>
      </div>
    </>
  );
}
