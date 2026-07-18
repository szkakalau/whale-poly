export async function GET() {
  const faq = [
    {
      question: 'How is SightWhale different from Polymarket\'s own analytics?',
      answer:
        'Polymarket shows you what happened. SightWhale tells you who made it happen, how much they bet, and whether they\'ve been right before — then pushes it to your phone. Every past signal is auditable on the History page.',
    },
    {
      question: 'How do I know the signals are real?',
      answer:
        'Every signal is published on the History page — wins and losses. Compare any signal against the Polymarket blockchain. All trades are on-chain and verifiable.',
    },
    {
      question: 'Is whale tracking on Polymarket actually profitable?',
      answer:
        'Following raw large trades blindly loses money over time. Following scored, filtered signals from top-quintile wallets with proper position sizing shows positive expected value in backtests. Past performance does not guarantee future results.',
    },
    {
      question: 'What is the Whale Score methodology?',
      answer:
        'Composite 0-100 score using trader historical win rate (rolling 30/60/90-day windows), trade size relative to market depth, time decay since on-chain confirmation, and market context classification (directional bet vs. hedging vs. liquidity provision).',
    },
    {
      question: 'What if the signals don\'t make me money?',
      answer:
        'First month is covered by our money-back guarantee. Email castro.liu@me.com for a full refund. No forms, no arguing.',
    },
    {
      question: 'Do I need Telegram?',
      answer:
        'No. Telegram is optional. Use /analyze to query any market live, or browse the History page. Telegram is simply the fastest delivery channel (~30s latency).',
    },
    {
      question: 'What is wallet clustering and why does it matter?',
      answer:
        'Many large Polymarket traders control 10-50+ wallets. Without clustering, one trader\'s $500K position split across 30 wallets looks like 30 small traders. SightWhale clusters wallets by shared deposit addresses.',
    },
    {
      question: 'How does the refund work?',
      answer:
        'If SightWhale is not profitable for you in your first month, email castro.liu@me.com for a full refund. No questions asked.',
    },
  ];

  return Response.json(
    {
      site: 'SightWhale — Polymarket Whale Intelligence',
      url: 'https://www.sightwhale.com',
      last_updated: new Date().toISOString().split('T')[0],
      faq,
    },
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  );
}
