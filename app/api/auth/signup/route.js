import { NextResponse } from 'next/server';
import { countUsers, getUserByUsername, createUser } from '@/lib/db';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

// Account creation is intentionally gated: the very first account (when
// the app has no users yet) can be created freely, so you can bootstrap
// your own login. After that, only someone who is ALREADY logged in can
// create another account — this keeps the app private to the people you
// invite, rather than open to anyone who finds the URL.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const username = (body?.username || '').trim();
  const password = body?.password || '';

  if (!username || username.length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  let existingUserCount;
  try {
    existingUserCount = await countUsers();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  if (existingUserCount > 0) {
    // Not the first account — require the requester to already be logged in.
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const requestingUserId = await verifySessionToken(token);
    if (!requestingUserId) {
      return NextResponse.json(
        { error: 'You must be logged in to add another person.' },
        { status: 401 }
      );
    }
  }

  try {
    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const user = await createUser(id, username, password);

    // Log the new account in immediately only if this was the bootstrap
    // (first-ever) account — otherwise leave the current session as-is,
    // since an existing logged-in user is the one adding someone else.
    if (existingUserCount === 0) {
      const token = await createSessionToken(user.id);
      const res = NextResponse.json({ ok: true, username: user.username });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: '/',
      });
      return res;
    }

    return NextResponse.json({ ok: true, username: user.username });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
