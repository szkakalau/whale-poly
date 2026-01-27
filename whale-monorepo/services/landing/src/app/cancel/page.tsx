import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Checkout Canceled - Sight Whale',
  description: 'Your checkout was canceled. You can try again anytime.',
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
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <Header />
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
      <Footer />
    </div>
  );
}
