import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SightWhale.com Mini App',
  description: 'Telegram Mini App entry for SightWhale.com.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/tg',
  },
};

export default function TelegramLayout({ children }: { children: ReactNode }) {
  return children;
}
