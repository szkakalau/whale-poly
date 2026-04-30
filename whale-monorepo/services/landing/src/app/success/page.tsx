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
        <SuccessClient />
      </main>
      <Footer />
    </div>
  );
}
