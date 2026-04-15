import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

type WhaleWaitlistPayload = {
  email?: string;
  telegram?: string;
  segment?: string;
  notes?: string;
};

function isValidEmail(value: string): boolean {
  if (!value) return false;
  if (value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeShort(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

async function persistFallback(payload: {
  email: string;
  telegram: string;
  segment: string;
  notes: string;
  createdAtIso: string;
}) {
  const dir = path.join(process.cwd(), 'data', 'waitlist');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'whale_waitlist_leads.jsonl');
  await appendFile(file, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
}

export async function POST(req: Request) {
  let body: WhaleWaitlistPayload = {};
  try {
    body = (await req.json()) as WhaleWaitlistPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const email = sanitizeShort(body.email, 254).toLowerCase();
  const telegram = sanitizeShort(body.telegram, 64);
  const segment = sanitizeShort(body.segment, 64);
  const notes = sanitizeShort(body.notes, 2000);

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const createdAtIso = new Date().toISOString();

  try {
    await prisma.whaleWaitlistLead.create({
      data: {
        email,
        telegram: telegram || null,
        segment: segment || null,
        notes: notes || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Do not block waitlist capture if DB is unavailable/misconfigured.
    try {
      await persistFallback({ email, telegram, segment, notes, createdAtIso });
      return NextResponse.json({ ok: true, persisted: 'file_fallback' });
    } catch (fallbackErr) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      const fb = fallbackErr instanceof Error ? fallbackErr.message : 'fallback_unknown_error';
      return NextResponse.json(
        { ok: false, error: 'persist_failed', detail: message, fallbackDetail: fb },
        { status: 500 },
      );
    }
  }
}

