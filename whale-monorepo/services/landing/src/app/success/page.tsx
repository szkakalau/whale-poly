import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-x-hidden bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 pt-[calc(4.5rem+env(safe-area-inset-top,0px)+var(--sw-top-offset,0px))] sm:pt-[calc(6.5rem+env(safe-area-inset-top,0px)+var(--sw-top-offset,0px))] md:pt-32 pb-16 sm:pb-24 relative">
        <h1 className="text-4xl font-bold mb-6 text-white">Payment received</h1>
        <p className="text-gray-300 mb-10">
          Payment completed. Your subscription will be activated automatically after processing.
        </p>
        <div className="glass rounded-2xl border border-white/10 p-6 space-y-4 text-gray-300">
          <p>
            Open Telegram bot and run <span className="font-mono">/status</span> to confirm activation.
          </p>
          <p>
            If it’s not active yet, wait 1–2 minutes and try again.
          </p>
          <Link href="/follow" className="btn-primary inline-block mt-2">Go to dashboard</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
