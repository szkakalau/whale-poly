import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';

export const metadata: Metadata = {
  title: 'Contact — Sight Whale',
  description: 'Contact Sight Whale for support, partnerships, or press inquiries.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact — Sight Whale',
    description: 'Contact Sight Whale for support, partnerships, or press inquiries.',
    type: 'website',
    url: 'https://www.sightwhale.com/contact',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-12%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-10">
        <section className="space-y-4">
          <p className="text-xs font-bold text-cyan-400 tracking-[0.35em] uppercase">
            Contact
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Get in touch.
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-3xl">
            We respond to most inquiries within 1–2 business days.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-3">
            <h2 className="text-lg font-semibold text-white">Support</h2>
            <p className="text-sm text-gray-300">
              Product questions, billing issues, or bug reports:
            </p>
            <a
              className="text-violet-300 hover:text-violet-200 underline underline-offset-4"
              href="mailto:support@sightwhale.com"
            >
              support@sightwhale.com
            </a>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-3">
            <h2 className="text-lg font-semibold text-white">Partnerships / Press</h2>
            <p className="text-sm text-gray-300">
              If you want to collaborate or feature Sight Whale:
            </p>
            <a
              className="text-violet-300 hover:text-violet-200 underline underline-offset-4"
              href="mailto:partnerships@sightwhale.com"
            >
              partnerships@sightwhale.com
            </a>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 space-y-4">
          <h2 className="text-lg font-semibold text-white">Telegram</h2>
          <p className="text-sm text-gray-300">
            For real-time alerts, open the bot and follow the onboarding prompts.
          </p>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-50 hover:bg-violet-500/30"
          >
            Open Telegram Bot
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
}

