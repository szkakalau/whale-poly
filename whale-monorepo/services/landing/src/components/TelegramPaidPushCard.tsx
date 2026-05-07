'use client';

import { useState } from 'react';

type Props = {
  telegramConnected: boolean;
  botUrl: string;
};

export default function TelegramPaidPushCard({ telegramConnected, botUrl }: Props) {
  const [pushOn, setPushOn] = useState(true);

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-2">Telegram delivery</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-2xl leading-relaxed">
        After you link Telegram, new signals can reach you there—often faster than this page. Mute or adjust delivery
        using the bot commands in Telegram (we do not store an on/off toggle on this site).
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
        <a
          href={botUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
        >
          {telegramConnected ? 'Open Telegram bot' : 'Link Telegram'}
        </a>
        <span className="text-sm text-gray-300">
          {telegramConnected ? (
            <>
              <span className="text-emerald-400 font-medium">Linked</span>
              <span className="text-gray-500 mx-2">|</span>
              <span className="text-gray-400">Unlink or pause inside the bot</span>
            </>
          ) : (
            <span className="text-amber-200/90">Not linked yet · use the button to connect</span>
          )}
        </span>
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-200 select-none">
          <input
            type="checkbox"
            checked={pushOn}
            onChange={(e) => {
              const next = e.target.checked;
              if (!next) {
                window.alert(
                  'Delivery cadence is controlled by the Telegram bot. To receive fewer notifications, use mute or subscription commands inside the SightWhale bot (this site does not save that setting).',
                );
              }
              setPushOn(next);
            }}
            className="h-4 w-4 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500/40"
          />
          Telegram push (explainer)
        </label>
      </div>
      <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
        This checkbox is UI-only and does not change server-side subscription state; delivery follows your bot link and
        account.
      </p>
    </section>
  );
}
