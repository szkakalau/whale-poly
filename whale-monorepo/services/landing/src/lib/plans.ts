import { Plan } from '@prisma/client';
import { AuthUser } from './auth';

export type Feature = 
  | 'whale_follow' 
  | 'collection_creation' 
  | 'smart_collection_access' 
  | 'whale_score_full' 
  | 'telegram_bot' 
  | 'priority_updates' 
  | 'early_access';

export interface PlanLimits {
  max_alerts_per_day: number | 'unlimited';
  alert_delay_minutes: number;
  max_follow_whales: number;
  max_collections: number;
  max_smart_collections: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.FREE]: {
    max_alerts_per_day: 3,
    alert_delay_minutes: 10,
    max_follow_whales: 0,
    max_collections: 0,
    max_smart_collections: 0,
  },
  [Plan.PRO]: {
    max_alerts_per_day: 'unlimited',
    alert_delay_minutes: 0,
    max_follow_whales: 20,
    max_collections: 3,
    max_smart_collections: 5,
  },
  [Plan.ELITE]: {
    max_alerts_per_day: 'unlimited',
    alert_delay_minutes: 0,
    max_follow_whales: 100,
    max_collections: 1000000, // unlimited
    max_smart_collections: 20,
  },
};

export function canAccessFeature(user: AuthUser, feature: Feature): boolean {
  const plan = user.plan as Plan;
  
  // Check if plan is expired
  if (user.planExpireAt && new Date() > user.planExpireAt) {
    return plan === Plan.FREE; // Expired users only have FREE features
  }

  switch (feature) {
    case 'whale_follow':
      return PLAN_LIMITS[plan].max_follow_whales > 0;
    case 'collection_creation':
      return PLAN_LIMITS[plan].max_collections > 0;
    case 'smart_collection_access':
      return plan === Plan.PRO || plan === Plan.ELITE;
    case 'whale_score_full':
      return plan === Plan.PRO || plan === Plan.ELITE;
    case 'telegram_bot':
      return plan === Plan.PRO || plan === Plan.ELITE;
    case 'priority_updates':
      return plan === Plan.ELITE;
    case 'early_access':
      return plan === Plan.ELITE;
    default:
      return false;
  }
}

export function getLimitValue(user: AuthUser, limit: keyof PlanLimits): number | 'unlimited' {
  const plan = (user.planExpireAt && new Date() > user.planExpireAt) ? Plan.FREE : user.plan as Plan;
  return PLAN_LIMITS[plan][limit];
}
