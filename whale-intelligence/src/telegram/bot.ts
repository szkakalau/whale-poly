import { Telegraf } from 'telegraf';
import { env } from '../config/env';
import { prisma } from '../db/prisma';

export function createBot() {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  // Anti-abuse: detect forwarded messages
  bot.on('message', async (ctx, next) => {
    const fwd = (ctx.message as any)?.forward_from;
    if (fwd) {
      try {
        const tgId = ctx.from.id;
        const binding = await prisma.telegram_bindings.findUnique({ where: { telegram_user_id: BigInt(tgId) } });
        if (binding) {
          await prisma.users.update({ where: { id: binding.user_id }, data: { status: 'expired', plan: 'free' } });
          console.warn(`Forward violation: user ${binding.user_id} downgraded/suspended`);
        }
      } catch (err) {
        console.error('Violation handling failed', err);
      }
    }
    return next();
  });

  bot.start(async (ctx) => {
    const parts = (ctx.message?.text || '').trim().split(/\s+/);
    const token = parts.length > 1 ? parts[1] : '';
    if (!token) {
      await ctx.reply('Missing access token. Use /start <access_token>.');
      return;
    }
    try {
      const tok = await prisma.access_tokens.findUnique({ where: { token } });
      if (!tok) {
        await ctx.reply('Invalid access token.');
        return;
      }
      if (tok.used) {
        await ctx.reply('Access token already used.');
        return;
      }
      if (tok.expires_at.getTime() < Date.now()) {
        await ctx.reply('Access token expired.');
        return;
      }
      // Enforce one Telegram account per user
      const existingForUser = await prisma.telegram_bindings.findUnique({ where: { user_id: tok.user_id } });
      const tgId = BigInt(ctx.from.id);
      const tgName = ctx.from.username || null;
      if (existingForUser && existingForUser.telegram_user_id !== tgId) {
        await ctx.reply('User already bound to a different Telegram account.');
        return;
      }
      // Bind
      await prisma.telegram_bindings.upsert({
        where: { user_id: tok.user_id },
        update: { telegram_user_id: tgId, telegram_username: tgName, bound_at: new Date() },
        create: { user_id: tok.user_id, telegram_user_id: tgId, telegram_username: tgName, bound_at: new Date() }
      });
      await prisma.access_tokens.update({ where: { token }, data: { used: true } });

      await ctx.reply('✅ Connection successful.\n\nYour Telegram account is now linked to your Whale Intelligence subscription.\n\nYou will start receiving private whale alerts here.');
    } catch (err) {
      console.error('Binding failed', err);
      await ctx.reply('Binding failed due to server error.');
    }
  });

  bot.command('status', async (ctx) => {
    try {
      const binding = await prisma.telegram_bindings.findUnique({ where: { telegram_user_id: BigInt(ctx.from.id) } });
      if (!binding) {
        await ctx.reply('No active binding found. Use /start <access_token>.');
        return;
      }
      const user = await prisma.users.findUnique({ where: { id: binding.user_id } });
      if (!user) {
        await ctx.reply('User not found.');
        return;
      }
      await ctx.reply(`Status: ${user.status}\nPlan: ${user.plan}\nExpires: ${user.expires_at.toISOString()}`);
    } catch (err) {
      console.error('Status failed', err);
      await ctx.reply('Status retrieval failed.');
    }
  });

  bot.help(async (ctx) => {
    await ctx.reply('/start <access_token>\n/status\n/help');
  });

  return bot;
}
