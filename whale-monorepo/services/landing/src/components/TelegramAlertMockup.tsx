import Image from 'next/image';
import { ChevronLeft, MoreVertical } from 'lucide-react';

/** Preview asset under public/ — swap filename here if you replace the screenshot. */
export const TELEGRAM_PREVIEW_IMAGE_PATH =
  '/images/alerts/ScreenShot_2026-03-29_003807_061.png';

const PREVIEW_WIDTH = 1410;
const PREVIEW_HEIGHT = 1028;

const TELEGRAM_BOT_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';

export default function TelegramAlertMockup() {
  return (
    <div className="mx-auto w-full max-w-[min(100%,26rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.16_0.03_252)] shadow-[0_24px_80px_oklch(0.1_0.03_252_/_0.55)] ring-1 ring-white/5">
      {/* Chat header */}
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-black/25 bg-[#17212b] px-3">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#6ab7ff] hover:bg-white/5 md:pointer-events-none"
          aria-hidden
          tabIndex={-1}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2b5278] text-sm font-black text-white">
            S
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight text-[#f5f5f5]">SightWhale</div>
            <div className="truncate text-[12px] leading-tight text-[#6c7883]">@sightwhale_bot</div>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#6ab7ff] opacity-90">
            <MoreVertical className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </header>

      {/* Chat body */}
      <div
        className="relative min-h-[280px] bg-[#0e1621] px-3 pb-4 pt-4"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(42,82,120,0.12) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(86,140,200,0.08) 0%, transparent 40%)',
        }}
      >
        <div className="flex gap-2">
          <div
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full bg-[#2b5278] text-[11px] font-black text-white"
            aria-hidden
          >
            S
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-block max-w-full rounded-2xl rounded-bl-md bg-[#2b5278] p-1.5 shadow-sm ring-1 ring-black/10">
              <div className="overflow-hidden rounded-lg bg-[#182533]">
                <Image
                  src={TELEGRAM_PREVIEW_IMAGE_PATH}
                  alt="Example SightWhale alert message as received in Telegram"
                  width={PREVIEW_WIDTH}
                  height={PREVIEW_HEIGHT}
                  sizes="(max-width: 640px) 95vw, 416px"
                  className="h-auto w-full max-w-full object-contain"
                  priority={false}
                />
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1.5 pl-1">
              <span className="text-[11px] tabular-nums text-[#6c7883]">14:32</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-black/20 bg-[#17212b] px-4 py-3 text-center">
        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-semibold text-[#6ab7ff] hover:text-[#8bcfff] underline decoration-[#6ab7ff]/35 underline-offset-4"
        >
          Open @sightwhale_bot
        </a>
      </div>
    </div>
  );
}
