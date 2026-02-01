import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import SmartCollectionDetailClient from './SmartCollectionDetailClient';

type PageParams = {
  params: Promise<{ id: string }>;
};

export default async function SmartCollectionDetailPage({
  params,
}: PageParams) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-32 relative">
          <h1 className="text-2xl font-semibold text-white mb-4">
            Smart collection
          </h1>
          <p className="text-sm text-gray-400">
            Please sign in to view and subscribe to smart collections.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const sc = await prisma.smartCollection.findUnique({
    where: {
      id,
    },
    include: {
      whales: {
        orderBy: {
          snapshotDate: 'desc',
        },
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

  if (!sc || !sc.enabled) {
    return (
      <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-32 relative">
          <h1 className="text-2xl font-semibold text-white mb-4">
            Smart collection not found
          </h1>
          <p className="text-sm text-gray-400">
            This smart collection does not exist or is not accessible.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const allWhales = sc.whales;
  let latestWhales = allWhales;
  if (allWhales.length > 0) {
    const latest = allWhales[0].snapshotDate;
    latestWhales = allWhales.filter(
      (w: (typeof allWhales)[number]) =>
        w.snapshotDate.getTime() === latest.getTime(),
    );
  }

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-8">
        <SmartCollectionDetailClient
          id={sc.id}
          name={sc.name}
          description={sc.description ?? ''}
          ruleJson={sc.ruleJson}
          enabled={sc.enabled}
          initialSubscribed={sc.subscriptions.length > 0}
          whales={latestWhales.map((w: (typeof latestWhales)[number]) => {
            return {
              wallet: w.wallet,
              snapshotDate: w.snapshotDate.toISOString(),
            };
          })}
        />
      </main>

      <Footer />
    </div>
  );
}

