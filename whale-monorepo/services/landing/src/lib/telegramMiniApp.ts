import {
  encoder, decoder,
  toArrayBuffer, bytesToBase64, base64ToBytes,
  base64UrlEncode, base64UrlDecode,
  base64UrlEncodeString, base64UrlDecodeToString,
  hmacSha256, hmacSha256Hex,
} from '@/lib/crypto';

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type TelegramWebAppAuthResult = {
  user: TelegramWebAppUser;
  authDate: number;
  queryId?: string;
};

function buildDataCheckString(params: URLSearchParams): string {
  const pairs: string[] = [];
  const keys = Array.from(params.keys())
    .filter((k) => k !== 'hash')
    .sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const value = params.get(key);
    if (value === null) continue;
    pairs.push(`${key}=${value}`);
  }
  return pairs.join('\n');
}

export async function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 300): Promise<TelegramWebAppAuthResult> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDateRaw = params.get('auth_date');
  // Guard against empty bot token — produces deterministic HMAC an attacker can forge
  if (!botToken) throw new Error('no_bot_token');
  const userRaw = params.get('user');

  if (!hash || !authDateRaw || !userRaw) {
    throw new Error('missing_fields');
  }

  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) {
    throw new Error('bad_auth_date');
  }

  const now = Math.floor(Date.now() / 1000);
  if (maxAgeSeconds > 0 && now - authDate > maxAgeSeconds) {
    throw new Error('auth_expired');
  }

  const dataCheckString = buildDataCheckString(params);
  const secretKey = await hmacSha256(encoder.encode('WebAppData'), botToken);
  const computedHash = await hmacSha256Hex(secretKey, dataCheckString);

  if (computedHash !== hash) {
    throw new Error('hash_mismatch');
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw new Error('bad_user_json');
  }
  if (!user?.id || !Number.isFinite(user.id)) {
    throw new Error('bad_user');
  }

  return {
    user,
    authDate,
    queryId: params.get('query_id') || undefined,
  };
}

export type MiniAppSessionPayload = {
  uid: string;
  tid: string;
  exp: number;
};

export async function signMiniAppSessionCookie(payload: MiniAppSessionPayload, secret: string): Promise<string> {
  const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));
  const sigBytes = await hmacSha256(encoder.encode(secret), payloadB64);
  const sigB64 = base64UrlEncode(sigBytes);
  return `${payloadB64}.${sigB64}`;
}

export async function verifyMiniAppSessionCookie(token: string, secret: string): Promise<MiniAppSessionPayload | null> {
  const parts = (token || '').split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const expectedSigBytes = await hmacSha256(encoder.encode(secret), payloadB64);
  const expectedSigB64 = base64UrlEncode(expectedSigBytes);
  if (expectedSigB64 !== sigB64) return null;

  let payload: MiniAppSessionPayload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64)) as MiniAppSessionPayload;
  } catch {
    return null;
  }

  if (!payload?.uid || !payload?.tid || !Number.isFinite(payload.exp)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;

  return payload;
}
