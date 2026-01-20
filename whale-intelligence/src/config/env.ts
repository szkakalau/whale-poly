import dotenv from 'dotenv';
dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  PORT: Number(process.env.PORT || 4000),
  ACCESS_TOKEN_TTL_MINUTES: Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15),
  POLYMARKET_TRADES_URL: process.env.POLYMARKET_TRADES_URL || 'https://clob.polymarket.com/trades',
  POLYMARKET_MARKETS_URL: process.env.POLYMARKET_MARKETS_URL || 'https://clob.polymarket.com/markets',
  POLYMARKET_ORDERBOOK_URL: process.env.POLYMARKET_ORDERBOOK_URL || 'https://clob.polymarket.com/orderbook',
  POLYMARKET_SETTLEMENTS_URL: process.env.POLYMARKET_SETTLEMENTS_URL || 'https://clob.polymarket.com/settlements',
  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || '',
  STRIPE_PRICE_ELITE: process.env.STRIPE_PRICE_ELITE || '',
  // Alert delivery controls
  FREE_ALERT_DELAY_MINUTES: Number(process.env.FREE_ALERT_DELAY_MINUTES || 90),
  MARKET_ALERT_RATE_LIMIT_MINUTES: Number(process.env.MARKET_ALERT_RATE_LIMIT_MINUTES || 15)
};

if (!env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Prisma will fail to connect until it is provided.');
}
if (!env.TELEGRAM_BOT_TOKEN) {
  console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.');
}
if (!env.POLYMARKET_MARKETS_URL || !env.POLYMARKET_ORDERBOOK_URL) {
  console.warn('POLYMARKET_MARKETS_URL / POLYMARKET_ORDERBOOK_URL not set. Market metadata and orderbook ingestion will be disabled.');
}
if (!env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set. Stripe webhook will not verify signatures.');
}
