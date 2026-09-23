const COOKIE_NAME = 'bloom_trail_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

function getSecret() {
  const secret = process.env.BLOOM_TRAIL_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'BLOOM_TRAIL_SESSION_SECRET is not set. Add it to your environment variables.'
    );
  }
  return secret;
}

// Web Crypto (available in both the Edge Runtime, used by middleware, and
// Node's API routes) instead of Node's `crypto` module, which the Edge
// Runtime does not support.
async function hmacSha256Hex(message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualStr(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Builds a signed token: "<expiryTimestamp>.<signature>"
// This is intentionally simple — it just proves "someone who knew the PIN
// requested a session before this expiry", nothing more.
export async function createSessionToken() {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = String(expiry);
  const signature = await hmacSha256Hex(payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = await hmacSha256Hex(payload);
  if (!timingSafeEqualStr(signature, expected)) return false;

  const expiry = Number(payload);
  if (!Number.isFinite(expiry)) return false;
  return Date.now() < expiry;
}

export function checkPin(candidate) {
  const realPin = process.env.BLOOM_TRAIL_PIN;
  if (!realPin) {
    throw new Error('BLOOM_TRAIL_PIN is not set. Add it to your environment variables.');
  }
  if (!candidate || typeof candidate !== 'string') return false;
  return timingSafeEqualStr(candidate, realPin);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
