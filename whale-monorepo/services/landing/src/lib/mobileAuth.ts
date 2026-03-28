const encoder = new TextEncoder();
const decoder = new TextDecoder();

type MobileTokenPayload = {
  uid: string;
  exp: number;
  type: 'access';
};

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

async function hmacSha256(keyBytes: Uint8Array, data: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('crypto_unavailable');
  }
  const key = await subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, toArrayBuffer(encoder.encode(data)));
  return new Uint8Array(sig);
}

function getMobileAuthSecret(): string {
  return process.env.MOBILE_AUTH_SECRET || process.env.TELEGRAM_MINIAPP_SECRET || process.env.BOT_USER_HASH_SECRET || '';
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
