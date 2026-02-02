import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import SmartCollectionsClient, {
  type SmartCollectionItem,
} from '../SmartCollectionsClient';

type PageProps = {
  params: Promise<{ id: string }>;
};

async function loadSmartCollectionDetail(id: string, userId: string | null) {
  const collection = await prisma.smartCollection.findUnique({
    where: {
      id,
    },
    include: {
      whales: {
        orderBy: {
          snapshotDate: 'desc',
        },
        take: 100,
      },
    },
  });

  if (!collection || !collection.enabled) {
    return null;
  }

  const latestSnapshot =
    collection.whales.length > 0
      ? collection.whales[0].snapshotDate
      : null;

  const whales =
    latestSnapshot === null
      ? []
      : collection.whales.filter(
          (w) => w.snapshotDate.getTime() === latestSnapshot.getTime(),
        );

  let subscribed = false;
  if (userId) {
    const sub = await prisma.smartCollectionSubscription.findUnique({
      where: {
        user_smart_collection_unique: {
          userId,
          smartCollectionId: collection.id,
        },
      },
      select: {
        id: true,
      },
    });
    subscribed = Boolean(sub);
  }

  return {
    item: {
      id: collection.id,
      name: collection.name,
      description: collection.description ?? '',
      subscribed,
    } as SmartCollectionItem,
    whales: whales.map((w) => ({
      wallet: w.wallet,
    })),
  };
}

export default async function SmartCollectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const detail = await loadSmartCollectionDetail(id, user ? user.id : null);

  if (!detail) {
    return (
      <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-3xl px-6 pt-32 pb-24 relative">
          <h1 className="text-2xl font-semibold text-white mb-4">
            Smart collection not found
          </h1>
          <p className="text-sm text-gray-400 mb-6">
            This smart collection is not available. It may have been disabled or does not exist.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-32 pb-24 relative space-y-8">
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
              Smart Collection
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {detail.item.name}
            </h1>
            {detail.item.description && (
              <p className="text-sm text-gray-400 max-w-xl">
                {detail.item.description}
              </p>
            )}
          </div>
          <div className="min-w-[220px]">
            <SmartCollectionsClient
              initialItems={[detail.item]}
              canManage={Boolean(user)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">
              Current whales in this collection
            </h2>
          </div>
          {detail.whales.length === 0 ? (
            <div className="text-sm text-gray-400">
              No wallets are currently in this smart collection snapshot. As new whales meet the
              rules, they will appear here and drive alerts for subscribers.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Wallet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-200">
                  {detail.whales.map((w) => (
                    <tr key={w.wallet} className="hover:bg-white/[0.03]">
                      <td className="px-3 py-2 font-mono text-xs">
                        {w.wallet}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

