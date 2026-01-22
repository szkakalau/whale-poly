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

  // Start HTTP server immediately for Render health checks
  const server = app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });

  // Telegram bot (runs in background)
  if (env.TELEGRAM_BOT_TOKEN) {
    const bot = createBot();
    
    // Start jobs immediately, passing the bot instance.
    // Even if bot launch (polling) fails or hangs, we want ingestion to run.
    console.log('Starting scheduled jobs...');
    startJobs(bot);

    console.log('Launching Telegram bot...');
    // Launch in background with retry logic
    (async () => {
      let retries = 5;
      while (retries > 0) {
        try {
          await bot.launch({
            dropPendingUpdates: true,
            allowedUpdates: ['message', 'callback_query'],
          });
          console.log('Telegram bot launched successfully');
          
          // Graceful stop
          const stopBot = () => bot.stop('SIGINT');
          process.once('SIGINT', stopBot);
          process.once('SIGTERM', stopBot);
          return;
        } catch (err) {
          console.error(`Telegram bot launch failed (retries left: ${retries - 1})`, err);
          retries--;
          if (retries > 0) {
            await new Promise(res => setTimeout(res, 5000));
          } else {
            console.error('Telegram bot failed to launch after max retries. Alerts may not work, but ingestion will continue.');
          }
        }
      }
    })();
  } else {
    console.warn('Telegram bot not launched; token missing');
    startJobs();
  }
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});
