export type PricingTier = 'pro' | 'elite';

export type PricingPlanCard = {
  tier: PricingTier;
  name: string;
  monthly: number;
  yearly: number;
  kicker: string;
  description: string;
  features: string[];
  href: string;
  highlighted: boolean;
};

/** Single source of truth for marketing + pricing UI (keep in sync with Stripe products). */
export const PRICING_PLAN_CARDS: PricingPlanCard[] = [
  {
    tier: 'pro',
    name: 'Pro',
    monthly: 29,
    yearly: 290,
    kicker: 'Best for most traders',
    description: 'Real-time signals in the app plus optional Telegram.',
    features: [
      'All real-time signals (in-app)',
      'All 70+ Whale Score signals',
      'Optional Telegram (~30s)',
      'Higher follow & collection limits vs Free',
    ],
    href: '/subscribe?plan=pro',
    highlighted: true,
  },
  {
    tier: 'elite',
    name: 'Elite',
    monthly: 59,
    yearly: 590,
    kicker: 'Priority for active traders',
    description: 'Stricter filtering and faster optional Telegram.',
    features: [
      'Everything in Pro',
      '80+ high-conviction signals where applicable',
      'Optional Telegram (~10s priority)',
      'Largest follow & collection limits',
    ],
    href: '/subscribe?plan=elite',
    highlighted: false,
  },
];

export const PRICING_PRO_MONTHLY = PRICING_PLAN_CARDS[0].monthly;
export const PRICING_ELITE_MONTHLY = PRICING_PLAN_CARDS[1].monthly;
