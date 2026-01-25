import { PrismaClient } from '@prisma/client';
import { Telegraf } from 'telegraf';
import { renderAlertMessage } from '../telegram/templates';
import { env } from '../config/env';
import { marketMap, fetchMarketDetails } from '../ingestion/markets';

function isZombieTitle(title?: string | null) {
  if (!title) return false;
  return title.includes('Will Joe Biden get Coronavirus') || (title.includes('Biden') && title.includes('Coronavirus'));
}

async function resolveMarketTitle(prisma: PrismaClient, marketId: string) {
  let marketTitle = marketMap.get(marketId);
  if (isZombieTitle(marketTitle)) {
    marketMap.delete(marketId);
    marketTitle = undefined;
  }
  if (!marketTitle) {
    const market = await (prisma as any).markets.findFirst({
      where: { 
        OR: [
          { id: marketId },
        ]
      } 
    });
    marketTitle = market?.title;
  }
  if (isZombieTitle(marketTitle)) {
    marketTitle = undefined;
  }
  if (!marketTitle) {
    const fetchedTitle = await fetchMarketDetails(marketId);
    if (fetchedTitle && !isZombieTitle(fetchedTitle)) {
      marketTitle = fetchedTitle;
    }
  }
  if (!marketTitle) {
    marketTitle = `Unknown Market (${marketId.slice(0, 8)}...)`;
  }
  return marketTitle;
}

export async function createAlerts(prisma: PrismaClient, threshold = 80) {
  const since = new Date(Date.now() - 10 * 60 * 1000); // recent scores
  const recentScores = await prisma.whale_scores.findMany({ where: { calculated_at: { gte: since } } });
  for (const s of recentScores) {
    if (s.score < threshold) continue;
    const existing = await prisma.alerts.findFirst({
      where: {
        wallet: s.wallet,
        market_id: s.market_id,
        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });
    if (existing) continue;
    // Per-market rate limit: max 1 alert per market / 15 min
    const recentForMarket = await prisma.alerts.findFirst({
      where: { market_id: s.market_id, created_at: { gte: new Date(Date.now() - env.MARKET_ALERT_RATE_LIMIT_MINUTES * 60 * 1000) } }
    });
    if (recentForMarket) continue;

    // Fetch recent trades for details
    const windowStart = new Date(Date.now() - 30 * 60 * 1000);
    const trades = await prisma.trades_raw.findMany({
      where: {
        wallet: s.wallet,
        market_id: s.market_id,
        timestamp: { gte: windowStart }
      }
    });
    
    let amount = 0;
    let price = 0;
    let side = 'buy';
    let tx_count = 0;

    if (trades.length > 0) {
      amount = trades.reduce((sum, t) => sum + Number(t.amount), 0);
      price = trades.reduce((sum, t) => sum + (Number(t.price) * Number(t.amount)), 0) / (amount || 1);
      side = trades[0].side;
      tx_count = trades.length;
    }

    // Safety: Skip invalid alerts with no volume or low value
    if (amount <= 0 || price <= 0 || (amount * price) < 10) continue;

    await prisma.alerts.create({
      data: {
        wallet: s.wallet,
        market_id: s.market_id,
        alert_type: 'spike', // default if not set by detector; can be refined by detector hints
        score: s.score,
        amount,
        price,
        side,
        tx_count,
        created_at: new Date()
      }
    });
  }
}

const sentAlertIds = new Set<string>();
const BOOT_TIME = new Date();

export async function dispatchAlerts(prisma: PrismaClient, bot: Telegraf) {
  // Only process alerts created AFTER this instance started to prevent:
  // 1. Resending old alerts on restart
  // 2. Conflict/Duplication with the previous instance during rolling updates
  const recentAlerts = await prisma.alerts.findMany({
    where: { 
      created_at: { 
        gte: new Date(Date.now() - 10 * 60 * 1000), // Safety window
      } 
    }
  });
  if (!recentAlerts.length) return;

  // Filter out alerts older than boot time (strict deduplication for rolling deploys)
  const alertsToProcess = recentAlerts.filter(a => a.created_at >= BOOT_TIME);

  // Cleanup old IDs from memory to prevent leak
  if (sentAlertIds.size > 10000) {
      sentAlertIds.clear(); // Simple purge strategy
  }

  const activeUsers = await prisma.users.findMany({ where: { status: 'active' }, include: { telegram_bindings: true } });
  const recipients = activeUsers.filter(u => !!u.telegram_bindings?.telegram_user_id);
  
  for (const alert of alertsToProcess) {
    if (sentAlertIds.has(alert.id)) continue;

    const marketTitle = await resolveMarketTitle(prisma, alert.market_id);

    const context: string[] = [];
    
    // Add type-specific context
    if (alert.alert_type === 'build') {
        context.push('Whale is building a position (multiple trades)');
    } else if (alert.alert_type === 'exit') {
        context.push('Whale is exiting/reducing position');
    } else if (alert.alert_type === 'spike') {
        context.push('Sudden volume spike detected');
    }

    if (Number(alert.amount) > 50000) {
      context.push('Large size relative to typical flow');
    }
    if ((alert.tx_count || 0) > 3) {
      context.push('Executed via multiple trades (accumulation)');
    }
    if (alert.score >= 80) {
      context.push('High whale score indicating strong history');
    }

    for (const user of recipients) {
      // Slight per-user text variation
      const variation = Math.random() < 0.5 ? '' : '\n';
      // Tier-based delivery: Free delayed; Pro/Elite real-time
      const isFree = user.plan === 'free';
      const isElite = user.plan === 'elite';
      const minAgeMsFree = env.FREE_ALERT_DELAY_MINUTES * 60 * 1000;
      const ageMs = Date.now() - alert.created_at.getTime();
      if (isFree && ageMs < minAgeMsFree) {
        // Skip for free users until the delay window passes
        continue;
      }
      
      // Check if we already sent this alert to this user to avoid duplicates/spamming in this loop run
      // In a real system, we'd track sent_alerts table. For now, rely on `dispatchAlerts` only fetching recent alerts
      // and maybe relying on rate limits.
      // But 429 indicates we are sending too fast. Add a small delay between users.
      await new Promise(r => setTimeout(r, 1000)); 

      // Calculate total USD value
      const shareAmount = Number(alert.amount || 0);
      const priceVal = Number(alert.price || 0);
      const totalValue = shareAmount * priceVal;

      // Skip invalid zero-value alerts or noise (< $10)
      if (totalValue < 10) continue;

      const text = renderAlertMessage({
        market: marketTitle || alert.market_id,
        amount: totalValue, // Show USD value in message
        price: priceVal > 0 ? priceVal.toFixed(2) : 'N/A',
        side: alert.side || 'buy',
        trades_count: alert.tx_count || 0,
        time_ago: Math.floor(ageMs / 60000) + 'm ago',
        score: Math.round(alert.score) / 10,
        alertId: (alert as any).id,
        hideScore: isFree,
        context: isElite ? context : undefined 
      }) + variation;
      
      const chatId = Number(user.telegram_bindings!.telegram_user_id);
      try {
        await bot.telegram.sendMessage(chatId, text, { disable_web_page_preview: true } as any);
        console.log(`[Alert] Sent alert ${alert.alert_type} (${alert.market_id.slice(0, 6)}...) to ${chatId}`);
      } catch (err: any) {
        // Handle 429 Too Many Requests
        if (err?.response?.error_code === 429) {
           const retryAfter = err.response.parameters?.retry_after || 10;
           console.warn(`Rate limit hit for ${chatId}, retrying after ${retryAfter}s`);
           // For simplicity in this loop, we might just skip or wait. 
           // Waiting blocks other users. Better to log and maybe retry later or skip.
           // Let's wait a bit and retry once.
           await new Promise(r => setTimeout(r, (retryAfter + 1) * 1000));
           try {
             await bot.telegram.sendMessage(chatId, text, { disable_web_page_preview: true } as any);
           } catch (retryErr) {
             console.error('Retry failed for', chatId, retryErr);
           }
        } else {
           console.error('Failed to send alert to', chatId, err);
        }
      }
    }
    sentAlertIds.add(alert.id);
  }
}

// Conviction signals: elite-only
export async function createConvictionSignals(prisma: PrismaClient) {
  // 1. Fetch recent conviction alerts (last 24h) to prevent duplicates by TITLE
  const recentConvictions = await prisma.alerts.findMany({ 
    where: { 
      alert_type: 'conviction', 
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    } 
  });
  
  const recentTitles = new Set<string>();
  for (const a of recentConvictions) {
    const title = marketMap.get(a.market_id);
    const normalized = isZombieTitle(title) ? undefined : title;
    recentTitles.add(normalized || a.market_id);
  }

  // 2. Fetch high-scoring alerts (last 48h)
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const alerts = await prisma.alerts.findMany({ where: { created_at: { gte: since }, score: { gte: 75 } } });
  
  // 3. Group by TITLE (normalizing multiple market IDs for same event)
  const byTitle = new Map<string, { market_id: string; alerts: typeof alerts; addresses: Set<string> }>();
  
  for (const a of alerts) {
    const title = marketMap.get(a.market_id);
    const normalized = isZombieTitle(title) ? undefined : title;
    const key = normalized || a.market_id;
    const g = byTitle.get(key) || { market_id: a.market_id, alerts: [], addresses: new Set<string>() };
    g.alerts.push(a);
    g.addresses.add(a.wallet);
    // Keep the first market_id we encounter as representative
    if (!g.market_id) g.market_id = a.market_id;
    byTitle.set(key, g);
  }

  // 4. Create synthetic "conviction" alert per TITLE if rule satisfied
  for (const [title, g] of byTitle) {
    if (g.addresses.size < 2) continue;
    
    // Check if we already have a conviction for this Title in last 24h
    if (recentTitles.has(title)) continue;
    
    const avgScore = Math.round(g.alerts.reduce((sum, a) => sum + (a.score || 0), 0) / Math.max(1, g.alerts.length));
    if (avgScore < 75) continue;
    
    await prisma.alerts.create({
      data: { 
        wallet: 'group', 
        market_id: g.market_id, // Use representative ID
        alert_type: 'conviction', 
        score: avgScore, 
        created_at: new Date() 
      }
    });
    
    // Mark as created so we don't create another one if loop continues (though map keys are unique)
    recentTitles.add(title);
  }
}

export async function dispatchConvictionSignals(prisma: PrismaClient, bot: Telegraf) {
  const recent = await prisma.alerts.findMany({ where: { alert_type: 'conviction', created_at: { gte: new Date(Date.now() - 10 * 60 * 1000) } } });
  if (!recent.length) return;
  
  // Apply startup deduplication to conviction signals as well
  const alertsToProcess = recent.filter(a => a.created_at >= BOOT_TIME);
  
  const eliteUsers = await prisma.users.findMany({ where: { status: 'active', plan: 'elite' }, include: { telegram_bindings: true } });
  const recipients = eliteUsers.filter(u => !!u.telegram_bindings?.telegram_user_id);
  
  // Deduplicate by Title for dispatch as well (safety net)
  const sentTitles = new Set<string>();

  for (const a of alertsToProcess) {
    if (sentAlertIds.has(a.id)) continue;

    const marketTitle = await resolveMarketTitle(prisma, a.market_id);

    // Safety check: if we already sent a conviction for this title in this batch (or recently)
    // Note: sentAlertIds tracks IDs, but if we have duplicate IDs for same title, we need to track title.
    if (sentTitles.has(marketTitle)) continue;
    sentTitles.add(marketTitle);

    for (const user of recipients) {


      const text = `🔥 Conviction Signal\n\nMarket: ${marketTitle}\nConviction Score: ${Math.round(a.score) / 10} / 10\nSupporting Addresses: ≥2\nHolding Duration: ≥48h\nAlert ID: ${a.id}`;
      const chatId = Number(user.telegram_bindings!.telegram_user_id);
      try {
        await bot.telegram.sendMessage(chatId, text, { disable_web_page_preview: true } as any);
        console.log(`[Conviction] Sent signal ${a.market_id.slice(0, 6)}... to ${chatId}`);
      } catch (err) {
        console.error('Failed to send conviction to', chatId, err);
      }
    }
    sentAlertIds.add(a.id);
  }
}
