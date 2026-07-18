/**
 * Static content blocks for the homepage.
 * Extracted from page.tsx to keep the page component focused on layout.
 */

import {
  BarChart3, Bell, Clock, FileText, Globe,
  Search, ShieldCheck, TrendingUp, Zap,
} from 'lucide-react';

export const PAIN_POINTS = [
  {
    icon: Globe,
    title: '500+ markets. You can\'t watch them all.',
    description:
      'Polymarket lists hundreds of active markets across politics, sports, crypto, and more. No single person can track every whale move across every prediction market — but our engine does, 24/7.',
  },
  {
    icon: Clock,
    title: 'Whales move first. The crowd moves later.',
    description:
      'By the time you notice a big trade on the platform\'s UI, the odds have already shifted. Our real-time monitoring catches whale entries the moment they hit the chain.',
  },
  {
    icon: FileText,
    title: 'Most signal services hide their losers.',
    description:
      'Anyone can tweet winning screenshots. We publish every signal — wins, losses, and break-evens — on a public history page. If we can\'t prove it works, you shouldn\'t pay for it.',
  },
];

export const HOW_IT_WORKS = [
  {
    icon: Search,
    title: 'Track',
    description:
      'We continuously monitor every trade from the top 1% most profitable Polymarket wallets. Real-time on-chain data, no delays, no sampling.',
  },
  {
    icon: BarChart3,
    title: 'Score',
    description:
      'Our engine assigns each signal a conviction score based on trade size, wallet history, category expertise, and market context. Noise is filtered; signal survives.',
  },
  {
    icon: Bell,
    title: 'Deliver',
    description:
      'High-conviction signals reach your Telegram in ~30 seconds. Or query any market live on /analyze to see exactly what the whales are doing right now.',
  },
];

export const MOATS = [
  {
    icon: TrendingUp,
    title: 'Auditable forever',
    description:
      'Every signal — every win, every loss, every break-even — stays on the public record. Browse the complete history anytime. No cherry-picking, no deleted rows, no excuses.',
  },
  {
    icon: ShieldCheck,
    title: 'Money-back guarantee',
    description:
      'Not satisfied in your first month? Email us for a full refund. No forms, no arguing, no fine print. Our incentives are aligned with yours — we only win if you win.',
  },
  {
    icon: Zap,
    title: 'Push, don\'t pull',
    description:
      'Whale trades appear on your phone in ~30 seconds via Telegram. No dashboard to refresh, no app to install. Or use /analyze to actively query any market\'s whale activity live.',
  },
];

export const FAQ_ITEMS = [
  {
    q: 'How is this different from Polymarket\'s own analytics?',
    a: 'Polymarket shows you what happened. SightWhale tells you who made it happen, how much they bet, and whether they\'ve been right before — then pushes it to your phone. Plus, every past signal is auditable on our History page.',
  },
  {
    q: 'How do I know the signals are real?',
    a: 'Every signal we\'ve ever published is on the History page — wins and losses. Compare any signal against the Polymarket blockchain. If you find a deleted or altered row, we\'ll give you a year free.',
  },
  {
    q: 'What if the signals don\'t make me money?',
    a: 'First month is covered by our money-back guarantee. Email castro.liu@me.com and we\'ll refund your subscription in full. We\'d rather earn your trust than keep $29.',
  },
  {
    q: 'Do I need Telegram?',
    a: 'No. Telegram is optional. Use /analyze to query any market live, or browse the History page anytime. Telegram is simply the fastest way to receive signals — nothing to install, no dashboard to refresh.',
  },
];
