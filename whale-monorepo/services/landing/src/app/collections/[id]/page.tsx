import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import CollectionDetailClient from './CollectionDetailClient';

type PageParams = {
  params: Promise<{ id: string }>;
};

export default async function CollectionDetailPage({ params }: PageParams) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-32 relative">
          <h1 className="text-2xl font-semibold text-white mb-4">Collection</h1>
          <p className="text-sm text-gray-400">
            Please sign in to view and manage your collections.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const col = await prisma.collection.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      whales: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!col) {
    return (
      <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-32 relative">
          <h1 className="text-2xl font-semibold text-white mb-4">Collection not found</h1>
          <p className="text-sm text-gray-400">
            This collection does not exist or you do not have access to it.
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

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-8">
        <CollectionDetailClient
          id={col.id}
          name={col.name}
          description={col.description ?? ''}
          enabled={col.enabled}
          initialWhales={col.whales.map((w: (typeof col.whales)[number]) => {
            return { wallet: w.wallet };
          })}
        />
      </main>

      <Footer />
    </div>
  );
}
