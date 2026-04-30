import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SuccessClient from './SuccessClient';

export const metadata = {
  title: 'Payment Successful - SightWhale.com',
  description: 'Your payment was received. Subscription will activate after processing.',
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
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-32 relative">
        <Suspense fallback={<SuccessFallback />}>
          <SuccessClient />
        </Suspense>
      </main>
      <Footer />
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
