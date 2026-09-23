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

// Session token now carries WHICH user is logged in, not just "logged in or
// not" — this is what lets every API route scope data access to that one
// user's own profiles. Format: "<userId>.<expiryTimestamp>.<signature>"
export async function createSessionToken(userId) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiry}`;
  const signature = await hmacSha256Hex(payload);
  return `${payload}.${signature}`;
}

// Returns the userId if the token is valid and unexpired, otherwise null.
export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiryStr, signature] = parts;
  if (!userId || !expiryStr || !signature) return null;

  const payload = `${userId}.${expiryStr}`;
  const expected = await hmacSha256Hex(payload);
  if (!timingSafeEqualStr(signature, expected)) return null;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() >= expiry) return null;

  return userId;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
