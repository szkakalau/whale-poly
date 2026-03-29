import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { parseBearerToken, signMobileAccessToken } from '@/lib/mobileAuth';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    const authHeader = parseBearerToken(req.headers.get('authorization'));
    if (!authHeader) {
      return NextResponse.json({ detail: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ detail: 'token_invalid_or_expired' }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await signMobileAccessToken(user.id);
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'token_sign_failed';
    return NextResponse.json({ detail }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accessToken,
    expiresIn: 60 * 60 * 24 * 7,
  });
}
