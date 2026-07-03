import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { Plan } from '@prisma/client';

export async function POST() {
  try {
    const user = await requireUser();

    // 1) Cancel Stripe subscription via payment API (prevents continued billing).
    const paymentBase = process.env.PAYMENT_API_BASE_URL;
    let stripeCanceled = false;
    if (paymentBase) {
      try {
        const res = await fetch(`${paymentBase.replace(/\/$/, '')}/subscriptions/cancel`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          stripeCanceled = data?.stripe_canceled === true;
        }
        // Even if upstream fails, proceed with local downgrade — webhook will reconcile.
      } catch (err) {
        console.error('cancel_upstream_failed', err instanceof Error ? err.message : String(err));
      }
    }

    // 2) Local downgrade (payment API may have already done this, but idempotent).
    // Both writes wrapped in a transaction — if one fails, neither persists.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          plan: Plan.FREE,
          planExpireAt: null,
        },
      }),
      prisma.subscription.updateMany({
        where: { userId: user.id, status: 'active' },
        data: { status: 'cancelled' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stripe_canceled: stripeCanceled,
      plan: 'FREE',
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
