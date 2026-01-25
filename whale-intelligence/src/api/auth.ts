import { Request } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../config/env';

export type ApiTier = 'free' | 'pro' | 'elite';
export interface ApiContext {
  tier: ApiTier;
  delayMinutes: number; // data freshness gating
  resultLimit: number;  // pagination default limit cap
}

export async function getApiContext(req: Request): Promise<ApiContext> {
  const token = (req.headers['x-api-key'] || req.query.api_key || '') as string;
  const defaultDelay = env.FREE_ALERT_DELAY_MINUTES;

  if (!token) return { tier: 'free', delayMinutes: defaultDelay, resultLimit: 50 };
  try {
    const tok = await prisma.access_tokens.findUnique({ where: { token } });
    if (!tok) return { tier: 'free', delayMinutes: defaultDelay, resultLimit: 50 };
    const user = await prisma.users.findUnique({ where: { id: tok.user_id } });
    const tier = (user?.plan as ApiTier) || 'free';
    switch (tier) {
      case 'elite':
        return { tier, delayMinutes: 0, resultLimit: 500 };
      case 'pro':
        return { tier, delayMinutes: 0, resultLimit: 200 };
      default:
        return { tier: 'free', delayMinutes: defaultDelay, resultLimit: 50 };
    }
  } catch {
    return { tier: 'free', delayMinutes: defaultDelay, resultLimit: 50 };
  }
}

export function paginate<T>(items: T[], limit: number, offset: number) {
  const start = Math.max(0, offset);
  const end = start + Math.max(1, limit);
  return items.slice(start, end);
}