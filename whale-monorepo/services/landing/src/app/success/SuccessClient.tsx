'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';

/**
 * Telegram cannot push to a user who never opened a chat with the bot
 * (403 "bot can't initiate conversation with a user"). The `?start=activate`
 * payload is what opens that session, so every paid user must pass through it.
 */
const TELEGRAM_ACTIVATE_URL = `${TELEGRAM_BOT_URL}${TELEGRAM_BOT_URL.includes('?') ? '&' : '?'}start=activate`;

function signalsAppHref(): string {
  const explicit = process.env.NEXT_PUBLIC_SIGNALS_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (base) return `${base}/signals`;
  return '/pricing';
}

export default function SuccessClient() {
  const searchParams = useSearchParams();
  const plan = (searchParams.get('plan') || '').toLowerCase() || 'unknown';
  const sessionId = searchParams.get('session_id') || searchParams.get('checkout_session_id') || 'unknown';

  const dashboardHref = useMemo(() => signalsAppHref(), []);

  useEffect(() => {
    trackEvent('payment_success_view', {
      page: 'success',
      plan,
      session_id_present: sessionId !== 'unknown',
    });
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
        <p className="font-medium text-white">
          One required step: activate alerts in Telegram.
        </p>
        <p>
          Telegram bots can only message you after you open the chat once. Tap the button below and
          press <span className="font-mono">START</span> — that is what enables real-time whale alerts.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={TELEGRAM_ACTIVATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent('success_activate_click', {
                page: 'success',
                section: 'success_actions',
                destination: 'telegram_activate_deeplink',
                plan,
              })
            }
            className="btn-primary inline-flex items-center justify-center"
          >
            Activate alerts in Telegram
          </a>
          <Link
            href={dashboardHref}
            onClick={() =>
              trackEvent('success_dashboard_click', {
                page: 'success',
                section: 'success_actions',
                destination: dashboardHref,
                plan,
              })
            }
            className="btn-primary inline-flex items-center justify-center"
          >
            Open live signals
          </Link>
        </div>
      </div>
    </>
  );
}
