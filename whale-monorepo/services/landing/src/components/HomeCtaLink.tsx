'use client';

import type { ReactNode } from 'react';
import Link, { type LinkProps } from 'next/link';
import { trackEvent } from '@/lib/analytics';

export type HomeCtaPlacement =
  | 'hero_primary'
  | 'hero_secondary'
  | 'hero_price_anchor'
  | 'live_unlock'
  | 'trust_history'
  | 'closing'
  | 'sticky';

export function HomeCtaLink({
  href,
  placement,
  className,
  children,
  ...rest
}: LinkProps & {
  placement: HomeCtaPlacement;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent('home_cta_click', { placement, href: String(href) })}
      {...rest}
    >
      {children}
    </Link>
  );
}
