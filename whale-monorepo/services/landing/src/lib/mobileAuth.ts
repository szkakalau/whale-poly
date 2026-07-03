import {
  encoder, decoder,
  toArrayBuffer, base64ToBytes,
  base64UrlEncode, base64UrlDecode,
  hmacSha256,
} from '@/lib/crypto';

type MobileTokenPayload = {
  uid: string;
  exp: number;
  type: 'access';
};

/**
 * Session signing secret. Uses exactly one env var — no fallback chain.
 * A fallback chain ending in '' means unconfigured deployments have forgeable tokens.
 */
function getMobileAuthSecret(): string {
  const secret = process.env.MOBILE_AUTH_SECRET || '';
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('FATAL: MOBILE_AUTH_SECRET is not set — mobile sessions are insecure');
  }
  return secret;
}

export function parseBearerToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const [scheme, token] = value.trim().split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

export async function signMobileAccessToken(uid: string, ttlSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const secret = getMobileAuthSecret();
  if (!secret) {
    throw new Error('mobile_auth_secret_missing');
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: MobileTokenPayload = { uid, exp, type: 'access' };
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSha256(encoder.encode(secret), payloadB64);
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

export async function verifyMobileAccessToken(token: string): Promise<MobileTokenPayload | null> {
  const secret = getMobileAuthSecret();
  if (!secret) return null;
  const parts = (token || '').split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = await hmacSha256(encoder.encode(secret), payloadB64);
  if (base64UrlEncode(expectedSig) !== sigB64) return null;
  let payload: MobileTokenPayload;
  try {
    payload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64))) as MobileTokenPayload;
  } catch {
    return null;
  }
  if (!payload?.uid || payload.type !== 'access' || !Number.isFinite(payload.exp)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;
  return payload;
}
