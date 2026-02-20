import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Subscribe - Sight Whale',
  description: 'Subscribe to receive real-time whale intelligence alerts.',
  alternates: {
    canonical: '/subscribe',
  },
};

export default function SubscribeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
