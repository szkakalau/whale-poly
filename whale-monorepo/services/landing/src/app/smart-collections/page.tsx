import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import SmartCollectionsClient, {
  type SmartCollectionItem,
} from './SmartCollectionsClient';

export const metadata = {
  title: 'Smart Collections - Sight Whale',
  description:
    'System-generated whale groups based on rule-based criteria like win rate and volume.',
  alternates: {
    canonical: '/smart-collections',
  },
};

async function loadSmartCollections(): Promise<SmartCollectionItem[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }
  const rows = await prisma.smartCollection.findMany({
    where: {
      enabled: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      _count: {
        select: { whales: true },
      },
      subscriptions: {
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
      },
    },
  });
  return rows.map((c: (typeof rows)[number]) => {
    return {
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      ruleJson: c.ruleJson,
      enabled: c.enabled,
      whaleCount: c._count.whales,
      subscribed: c.subscriptions.length > 0,
    };
  });
}

export default async function SmartCollectionsPage() {
  const items = await loadSmartCollections();

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-32 pb-24 relative">
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Smart Collections
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            System-generated cohorts of whales built from rules like minimum
            score, volume, and trade frequency.
          </p>
        </section>

        <section>
          <SmartCollectionsClient initialItems={items} />
        </section>
      </main>

      <Footer />
    </div>
  );
}

