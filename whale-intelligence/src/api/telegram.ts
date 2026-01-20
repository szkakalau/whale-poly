import { Router } from 'express';
import { prisma } from '../db/prisma';

export const telegramRouter = Router();

telegramRouter.post('/bind', async (req, res) => {
  const { access_token, telegram_user_id, telegram_username } = req.body || {};
  if (!access_token || !telegram_user_id) {
    res.status(400).json({ error: 'Missing access_token or telegram_user_id' });
    return;
  }
  try {
    const tok = await prisma.access_tokens.findUnique({ where: { token: access_token } });
    if (!tok) return res.status(400).json({ error: 'Invalid access token' });
    if (tok.used) return res.status(400).json({ error: 'Access token already used' });
    if (tok.expires_at.getTime() < Date.now()) return res.status(400).json({ error: 'Access token expired' });

    const existingForUser = await prisma.telegram_bindings.findUnique({ where: { user_id: tok.user_id } });
    const tgId = BigInt(telegram_user_id);
    if (existingForUser && existingForUser.telegram_user_id !== tgId) {
      return res.status(400).json({ error: 'User already bound to a different Telegram account' });
    }

    await prisma.telegram_bindings.upsert({
      where: { user_id: tok.user_id },
      update: { telegram_user_id: tgId, telegram_username: telegram_username || null, bound_at: new Date() },
      create: { user_id: tok.user_id, telegram_user_id: tgId, telegram_username: telegram_username || null, bound_at: new Date() }
    });
    await prisma.access_tokens.update({ where: { token: access_token }, data: { used: true } });
    res.json({ success: true });
  } catch (err) {
    console.error('Bind API error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

telegramRouter.get('/status', async (req, res) => {
  const tgId = req.query.telegram_user_id;
  if (!tgId) return res.status(400).json({ error: 'Missing telegram_user_id' });
  try {
    const binding = await prisma.telegram_bindings.findUnique({ where: { telegram_user_id: BigInt(String(tgId)) } });
    if (!binding) return res.status(404).json({ error: 'No binding found' });
    const user = await prisma.users.findUnique({ where: { id: binding.user_id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ status: user.status, plan: user.plan, expires_at: user.expires_at });
  } catch (err) {
    console.error('Status API error', err);
    res.status(500).json({ error: 'Server error' });
  }
});
