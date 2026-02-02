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
    'System-generated groups of whales clustered by strategy, performance, and behavior.',
  alternates: {
    canonical: '/smart-collections',
  },
};

async function loadSmartCollections(userId: string | null): Promise<SmartCollectionItem[]> {
  const [collections, subscriptions] = await Promise.all([
    prisma.smartCollection.findMany({
      where: {
        enabled: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    userId
      ? prisma.smartCollectionSubscription.findMany({
          where: {
            userId,
          },
          select: {
            smartCollectionId: true,
          },
        })
      : [],
  ]);

  const subscribedSet = new Set(
    subscriptions.map((s) => s.smartCollectionId),
  );

  return collections.map((c) => {
    return {
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      subscribed: subscribedSet.has(c.id),
    };
  });
}

export default async function SmartCollectionsPage() {
  const user = await getCurrentUser();
  const items = await loadSmartCollections(user ? user.id : null);

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
            System-generated groups of whales, clustered by on-chain behavior, market focus, and
            historical performance. Subscribe to follow whole strategies, not just individual
            wallets.
          </p>
        </section>

        <section>
          <SmartCollectionsClient
            initialItems={items}
            canManage={Boolean(user)}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}

