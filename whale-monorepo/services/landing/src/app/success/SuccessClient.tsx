'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';

export default function SuccessClient() {
  const searchParams = useSearchParams();
  const plan = (searchParams.get('plan') || '').toLowerCase() || 'unknown';
  const sessionId = searchParams.get('session_id') || searchParams.get('checkout_session_id') || 'unknown';

  const dashboardHref = useMemo(() => '/follow', []);

  useEffect(() => {
    trackEvent('checkout_success', {
      page: 'success',
      plan,
      session_id_present: sessionId !== 'unknown',
    });
  }, [plan, sessionId]);

  return (
    <>
      <h1 className="mb-6 text-4xl font-bold text-white">Payment received</h1>
      <p className="mb-10 text-gray-300">
        Payment completed. Your subscription will be activated automatically after processing.
      </p>
      <div className="glass space-y-4 rounded-2xl border border-white/10 p-6 text-gray-300">
        <p>
          Open Telegram bot and run <span className="font-mono">/status</span> to confirm activation.
        </p>
        <p>If it&apos;s not active yet, wait 1-2 minutes and try again.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('success_telegram_click', { page: 'success', plan })}
            className="inline-flex items-center justify-center rounded-full border border-violet-500/60 bg-violet-500/10 px-5 py-3 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
          >
            Open Telegram Bot
          </a>
          <Link
            href={dashboardHref}
            onClick={() => trackEvent('success_dashboard_click', { page: 'success', plan })}
            className="btn-primary inline-flex items-center justify-center"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
