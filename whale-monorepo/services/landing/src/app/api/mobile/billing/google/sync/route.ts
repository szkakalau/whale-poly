import { NextResponse } from 'next/server';
import { Plan } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  hasGooglePlayVerificationConfig,
  isProductionEnvironment,
  verifyPlaySubscription,
} from '@/lib/googlePlayVerify';

type BillingSyncBody = {
  purchaseToken?: unknown;
  productId?: unknown;
  orderId?: unknown;
  purchaseTimeMs?: unknown;
  expiryTimeMs?: unknown;
  isAutoRenewing?: unknown;
};

const PRODUCT_PLAN_MAP: Record<string, { plan: Plan; price: number }> = {
  pro_monthly: { plan: Plan.PRO, price: 20 },
  pro_yearly: { plan: Plan.PRO, price: 200 },
  elite_monthly: { plan: Plan.ELITE, price: 99 },
  elite_yearly: { plan: Plan.ELITE, price: 999 },
};

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: 'unauthorized' }, { status: 401 });
  }

  let body: BillingSyncBody;
  try {
    body = (await req.json()) as BillingSyncBody;
  } catch {
    return NextResponse.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const purchaseToken = toSafeString(body.purchaseToken);
  const productId = toSafeString(body.productId);
  const orderId = toSafeString(body.orderId);
  const expiryTimeMs = toSafeNumber(body.expiryTimeMs);

  if (!purchaseToken || !productId || !orderId) {
    return NextResponse.json(
      { detail: 'purchaseToken, productId, and orderId are required' },
      { status: 400 },
    );
  }

  if (!hasGooglePlayVerificationConfig() && !Number.isFinite(expiryTimeMs)) {
    return NextResponse.json(
      { detail: 'expiryTimeMs is required when Google Play server verification is not configured' },
      { status: 400 },
    );
  }

  const mapped = PRODUCT_PLAN_MAP[productId];
  if (!mapped) {
    return NextResponse.json({ detail: 'unsupported_product', productId }, { status: 400 });
  }

  if (isProductionEnvironment() && !hasGooglePlayVerificationConfig()) {
    return NextResponse.json(
      { detail: 'google_play_not_configured', hint: 'Set GOOGLE_PLAY_PACKAGE_NAME and service account JSON' },
      { status: 503 },
    );
  }

  let planExpireAt: Date;
  let resolvedOrderId = orderId;

  if (hasGooglePlayVerificationConfig()) {
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || '';
    if (!packageName) {
      return NextResponse.json({ detail: 'GOOGLE_PLAY_PACKAGE_NAME_required' }, { status: 500 });
    }
    try {
      const verified = await verifyPlaySubscription({
        packageName,
        productId,
        purchaseToken,
      });
      planExpireAt = new Date(verified.expiryTimeMillis);
      if (Number.isNaN(planExpireAt.getTime())) {
        return NextResponse.json({ detail: 'google_play_invalid_expiry' }, { status: 502 });
      }
      const now = Date.now();
      if (verified.expiryTimeMillis < now) {
        return NextResponse.json({ detail: 'subscription_expired' }, { status: 400 });
      }
      if (verified.orderId && String(verified.orderId).trim()) {
        resolvedOrderId = String(verified.orderId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ detail: 'google_play_verify_failed', error: msg }, { status: 502 });
    }
  } else {
    planExpireAt = new Date(expiryTimeMs);
    if (Number.isNaN(planExpireAt.getTime())) {
      return NextResponse.json({ detail: 'invalid_expiryTimeMs' }, { status: 400 });
    }
  }

  const purchaseTokenHash = `gp_${Buffer.from(purchaseToken).toString('base64').replaceAll('=', '').slice(0, 48)}`;
  const subscriptionId = `gp_${resolvedOrderId.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 58)}`;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        plan: mapped.plan,
        planExpireAt,
      },
    }),
    prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      create: {
        userId: user.id,
        plan: mapped.plan,
        price: mapped.price,
        status: 'active',
        expiresAt: planExpireAt,
        stripeCustomerId: purchaseTokenHash,
        stripeSubscriptionId: subscriptionId,
      },
      update: {
        plan: mapped.plan,
        price: mapped.price,
        status: 'active',
        expiresAt: planExpireAt,
        stripeCustomerId: purchaseTokenHash,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    plan: mapped.plan,
    planExpireAt: planExpireAt.toISOString(),
    source: 'google_play_sync',
  });
}
