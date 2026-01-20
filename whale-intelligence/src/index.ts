import express from 'express';
import { env } from './config/env';
import { connectPrisma } from './db/prisma';
import { telegramRouter } from './api/telegram';
import { v1Router } from './api/v1';
import { stripeRouter } from './api/stripe';
import { createBot } from './telegram/bot';
import { startJobs } from './scheduler/jobs';

async function main() {
  await connectPrisma();

  const app = express();
  
  // CORS configuration
  app.use((req, res, next) => {
    const allowedOrigins = [
      'https://sightwhale.com', 
      'http://localhost:3000', 
      'http://localhost:3001'
    ];
    
    // Allow origins defined in environment variables (comma-separated)
    if (process.env.ALLOWED_ORIGINS) {
      allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
    }

    const origin = req.headers.origin;
    
    // Check if origin is allowed
    const isAllowed = origin && (
      allowedOrigins.includes(origin) || 
      origin.endsWith('.vercel.app') // Allow Vercel preview deployments
    );

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // APIs
  app.use('/api/telegram', telegramRouter);
  app.use('/api/v1', v1Router);
  app.use('/api/stripe', stripeRouter);

  // Health
  app.get('/health', (_, res) => res.json({ ok: true }));

  // Telegram bot
  if (env.TELEGRAM_BOT_TOKEN) {
    const bot = createBot();
    let launched = false;
    let retries = 5;

    // Retry logic for bot launch
    while (!launched && retries > 0) {
      try {
        // Use polling with deleteWebhook to resolve conflict
        await bot.launch({
          dropPendingUpdates: true,
          allowedUpdates: ['message', 'callback_query'],
        });
        console.log('Telegram bot launched');
        startJobs(bot);
        launched = true;

        // Graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
      } catch (err) {
        console.error(`Telegram bot launch failed (retries left: ${retries - 1})`, err);
        retries--;
        if (retries > 0) {
          await new Promise(res => setTimeout(res, 5000)); // Wait 5s before retry
        } else {
          console.error('Continuing without bot after max retries');
          startJobs();
        }
      }
    }
  } else {
    console.warn('Telegram bot not launched; token missing');
    startJobs();
  }

  app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});
