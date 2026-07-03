/**
 * Shared cryptographic utilities.
 *
 * Used by mobileAuth.ts, telegramMiniApp.ts — single implementation
 * so bugs are fixed once, not patched per consumer.
 */

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
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

export function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return base64ToBytes(padded);
}

export function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(encoder.encode(value));
}

export function base64UrlDecodeToString(value: string): string {
  return decoder.decode(base64UrlDecode(value));
}

export async function hmacSha256(keyBytes: Uint8Array, data: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('crypto_unavailable');
  }
  const key = await subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, toArrayBuffer(encoder.encode(data)));
  return new Uint8Array(sig);
}

export async function hmacSha256Hex(keyBytes: Uint8Array, data: string): Promise<string> {
  const sig = await hmacSha256(keyBytes, data);
  return Array.from(sig)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
