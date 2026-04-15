'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

type SegmentOption = {
  id: string;
  label: string;
};

const SEGMENTS: SegmentOption[] = [
  { id: 'solo_low', label: 'Solo trader · <$10k/month volume' },
  { id: 'solo_mid', label: 'Solo trader · $10k–$100k/month' },
  { id: 'solo_high', label: 'Solo trader · $100k+/month' },
  { id: 'team', label: 'Team / fund / community' },
];

function normalizeTelegram(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  return v.startsWith('@') ? v : `@${v}`;
}

export default function WhaleWaitlistPage() {
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [segment, setSegment] = useState(SEGMENTS[0]?.id ?? 'solo_low');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const tgNormalized = useMemo(() => normalizeTelegram(telegram), [telegram]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('submitting');

    try {
      const res = await fetch('/api/whale-waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          telegram: tgNormalized,
          segment,
          notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const code = String(data.error || 'submit_failed');
        setError(
          code === 'invalid_email'
            ? 'Please enter a valid email.'
            : 'Could not join the waitlist right now. Please try again in a moment.',
        );
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setError('Network error. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-12%] left-[-10%] w-[42%] h-[42%] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-14%] right-[-10%] w-[42%] h-[42%] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-24 sm:py-32 relative">
        <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Whale plan waitlist</p>
        <h1 className="mt-3 text-[34px] sm:text-5xl font-black tracking-tight text-white text-balance">
          Get first access to Whale.
        </h1>
        <p className="mt-3 text-[15px] sm:text-lg text-gray-300 leading-relaxed">
          Institutional-grade coverage, concierge onboarding, and custom exports. Join the waitlist to get early access
          and grandfathered pricing when Whale launches.
        </p>

        {status === 'success' ? (
          <section className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6 sm:p-7">
            <p className="text-sm font-semibold text-emerald-100">You&apos;re on the waitlist.</p>
            <p className="mt-2 text-sm text-gray-200 leading-relaxed">
              We&apos;ll email you when Whale opens. If you want to add context, reply to the confirmation email or contact{' '}
              <a
                href="mailto:support@sightwhale.com"
                className="font-semibold text-white underline decoration-white/20 underline-offset-4 hover:decoration-white/50"
              >
                support@sightwhale.com
              </a>
              .
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link
                href="/polymarket-alerts-tl"
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-extrabold text-white hover:bg-violet-400 transition-colors active:scale-[0.98]"
              >
                Back to pricing
              </Link>
              <Link
                href="/subscribe?plan=elite"
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 py-3.5 text-sm font-semibold text-white hover:border-violet-400/50 hover:bg-violet-500/10 transition-colors active:scale-[0.98]"
              >
                Need signals now? Go Elite
              </Link>
            </div>
          </section>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 sm:p-7"
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm text-gray-300 font-semibold">Email (required)</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  className="w-full min-h-[48px] rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60 transition-all"
                  placeholder="you@domain.com"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-gray-300 font-semibold">Telegram (optional)</label>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60 transition-all"
                  placeholder="@yourhandle"
                />
                <p className="text-xs text-gray-400">We&apos;ll only use this to speed up onboarding if needed.</p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-gray-300 font-semibold">Who is this for? (optional)</label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60 transition-all appearance-none"
                >
                  {SEGMENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-gray-300 font-semibold">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-violet-500/60 transition-all resize-y"
                  placeholder="What markets do you trade? What do you need from Whale?"
                />
              </div>
            </div>

            {status === 'error' ? (
              <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                <div className="font-semibold">Submission failed</div>
                <div className="mt-1 text-rose-200/90">{error}</div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-violet-500 px-6 py-4 text-base font-extrabold text-white hover:bg-violet-400 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? 'Joining…' : 'Join The Waitlist'}
            </button>

            <p className="mt-3 text-xs text-gray-400 text-center">
              Prefer email? Contact{' '}
              <a
                href="mailto:support@sightwhale.com?subject=Whale%20tier%20waitlist"
                className="text-gray-200 underline decoration-white/15 underline-offset-4 hover:decoration-white/40"
              >
                support@sightwhale.com
              </a>
              .
            </p>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
}

