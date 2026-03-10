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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return base64ToBytes(padded);
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(encoder.encode(value));
}

function base64UrlDecodeToString(value: string): string {
  return decoder.decode(base64UrlDecode(value));
}

async function hmacSha256(keyBytes: Uint8Array, data: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('crypto_unavailable');
  }
  const key = await subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, toArrayBuffer(encoder.encode(data)));
  return new Uint8Array(sig);
}

async function hmacSha256Hex(keyBytes: Uint8Array, data: string): Promise<string> {
  const sig = await hmacSha256(keyBytes, data);
  return Array.from(sig)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

export async function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400): Promise<TelegramWebAppAuthResult> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDateRaw = params.get('auth_date');
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
