import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function SuccessPage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-32 relative">
        <h1 className="text-4xl font-bold mb-6 text-white">Payment received</h1>
        <p className="text-gray-300 mb-10">
          Stripe payment completed. Your subscription will be activated automatically after webhook processing.
        </p>
        <div className="glass rounded-2xl border border-white/10 p-6 space-y-4 text-gray-300">
          <p>
            Open Telegram bot and run <span className="font-mono">/status</span> to confirm activation.
          </p>
          <p>
            If it’s not active yet, wait 1–2 minutes and try again.
          </p>
          <Link href="/" className="btn-primary inline-block mt-2">Back to home</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

