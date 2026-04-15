import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Checkout Canceled - SightWhale.com',
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
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-x-hidden bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 pt-[calc(4.5rem+env(safe-area-inset-top,0px)+var(--sw-top-offset,0px))] sm:pt-[calc(6.5rem+env(safe-area-inset-top,0px)+var(--sw-top-offset,0px))] md:pt-32 pb-16 sm:pb-24 relative">
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
