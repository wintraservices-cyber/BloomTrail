import { NextResponse } from 'next/server';
import { checkPin, createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { pin } = body || {};

  let valid;
  try {
    valid = checkPin(pin);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  if (!valid) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return res;
}
