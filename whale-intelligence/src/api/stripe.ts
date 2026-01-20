import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/prisma';
import { env } from '../config/env';

export const stripeRouter = Router();

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2025-12-15.clover' as any
});

// Map Stripe price IDs to internal plans
function mapPriceToPlan(priceId?: string): 'free' | 'pro' | 'elite' | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === env.STRIPE_PRICE_ELITE) return 'elite';
  return null;
}

// Helper to upsert user by email
async function upsertUserByEmail(email: string, plan: 'free' | 'pro' | 'elite', status: 'active' | 'expired', expiresAt?: Date) {
  const now = new Date();
  const defaultExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.users.upsert({
    where: { email },
    update: { plan, status, expires_at: expiresAt || defaultExpiry },
    create: { email, plan, status, expires_at: expiresAt || defaultExpiry }
  });
}

// Webhook endpoint
stripeRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    if (!env.STRIPE_WEBHOOK_SECRET || !sig) {
      // Fallback: parse JSON directly (not recommended for production)
      event = req.body as Stripe.Event;
    } else {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(rawBody, String(sig), env.STRIPE_WEBHOOK_SECRET);
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err);
    res.status(400).send('Bad signature');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email || session.customer_email;
        const priceId = (session.line_items?.data?.[0]?.price?.id) as string | undefined;
        const plan = mapPriceToPlan(priceId);
        const subObj = session.subscription ? await stripe.subscriptions.retrieve(String(session.subscription)) : undefined;
        const periodEnd = subObj ? (subObj as any).current_period_end : undefined;
        if (email && plan) {
          await upsertUserByEmail(email, plan, 'active', periodEnd ? new Date(periodEnd * 1000) : undefined);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = (sub.items.data[0]?.price?.id) as string | undefined;
        const plan = mapPriceToPlan(priceId);
        const periodEnd = (sub as any).current_period_end;
        // Get customer email
        let email: string | undefined;
        if (typeof sub.customer === 'string') {
          const cust = await stripe.customers.retrieve(sub.customer);
          email = (cust as Stripe.Customer).email || undefined;
        }
        if (email && plan) {
          await upsertUserByEmail(email, plan, 'active', new Date(periodEnd * 1000));
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        let email: string | undefined;
        if (typeof sub.customer === 'string') {
          const cust = await stripe.customers.retrieve(sub.customer);
          email = (cust as Stripe.Customer).email || undefined;
        }
        if (email) {
          await prisma.users.updateMany({ where: { email }, data: { status: 'expired' } });
        }
        break;
      }
      default:
        // Ignore other events
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling failed', err);
    res.status(500).json({ error: 'Server error' });
  }
});