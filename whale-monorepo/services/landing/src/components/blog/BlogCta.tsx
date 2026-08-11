'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

type BlogCtaProps = {
  language: 'en' | 'zh';
};

const COPY = {
  en: {
    heading: 'Track whale trades in real time',
    body: 'Get instant alerts when the top 1% most profitable Polymarket traders make a move. Free to start.',
    primary: 'See Plans',
    primaryHref: '/pricing',
    secondary: 'Try Telegram Bot',
    secondaryHref: 'https://t.me/sightwhale_bot',
  },
  zh: {
    heading: '实时追踪鲸鱼交易',
    body: '当 Polymarket 上最赚钱的 1% 交易者出手时，即刻收到警报。免费开始。',
    primary: '查看方案',
    primaryHref: '/pricing',
    secondary: '试试 Telegram Bot',
    secondaryHref: 'https://t.me/sightwhale_bot',
  },
};

export default function BlogCta({ language }: BlogCtaProps) {
  const t = COPY[language];

  return (
    <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-surface card-shadow border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex-1">
          <h3 className="text-lg sm:text-xl font-semibold font-display text-foreground mb-1.5">
            {t.heading}
          </h3>
          <p className="text-sm text-muted leading-relaxed max-w-lg">{t.body}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href={t.primaryHref}
            onClick={() => trackEvent('blog_cta_click', { placement: 'inline_banner', target: 'pricing', language, cta_type: 'primary' })}
            className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors duration-200"
          >
            {t.primary}
          </Link>
          <Link
            href={t.secondaryHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('blog_cta_click', { placement: 'inline_banner', target: 'telegram', language, cta_type: 'secondary' })}
            className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-surface-hover transition-colors duration-200"
          >
            {t.secondary}
          </Link>
        </div>
      </div>
    </div>
  );
}
