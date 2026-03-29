import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SmartMoneyClient from './SmartMoneyClient';

export const metadata = {
  title: 'Smart Money Leaderboard - SightWhale.com',
  description: 'Top Polymarket traders by Profit, ROI, and Volume. Subscribe to collections for real-time alerts.',
  alternates: {
    canonical: '/smart-money',
  },
};

async function loadInitial(): Promise<{ items: { wallet: string; volume: number; profit: number; roi: number }[] }> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/smart-money/leaderboard?orderBy=PNL&limit=25`, {
    cache: 'no-store',
    next: { revalidate: 0 },
  }).catch(() => null);
  if (!res || !res.ok) {
    return { items: [] };
  }
  const data = await res.json().catch(() => ({ items: [] }));
  return { items: Array.isArray(data.items) ? data.items : [] };
}

export default async function SmartMoneyPage() {
  const { items } = await loadInitial();

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-32 pb-24 relative space-y-8">
        <section className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Smart Money Leaderboard</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Pull smart money rankings from Polymarket (Profit/ROI/Volume) and subscribe to system collections for real-time alerts.
          </p>
        </section>

        <SmartMoneyClient initialItems={items} initialOrderBy="PNL" />
      </main>

      <Footer />
    </div>
  );
}
