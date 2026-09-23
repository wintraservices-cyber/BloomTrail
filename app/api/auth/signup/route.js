import { NextResponse } from 'next/server';
import { countUsers, getUserByUsername, createUser, getInvite, markInviteUsed } from '@/lib/db';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

// Account creation is gated one of three ways:
// 1. The very first account ever (bootstrap) — free, no login or invite needed.
// 2. An unexpired, unused invite token — the link itself is the credential.
// 3. An already-logged-in user creating another account directly.
// This keeps the app closed to the people you actually invite.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const username = (body?.username || '').trim();
  const password = body?.password || '';
  const inviteToken = (body?.invite || '').trim();

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

  let invite = null;
  let requestingUserId = null;

  if (existingUserCount > 0) {
    // Not the first account — need either a valid invite or an existing session.
    if (inviteToken) {
      try {
        invite = await getInvite(inviteToken);
      } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
      }
      if (!invite) {
        return NextResponse.json({ error: 'This invite link is not valid.' }, { status: 400 });
      }
      if (invite.used_at) {
        return NextResponse.json({ error: 'This invite link has already been used.' }, { status: 400 });
      }
      if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite link has expired.' }, { status: 400 });
      }
    } else {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      requestingUserId = await verifySessionToken(token);
      if (!requestingUserId) {
        return NextResponse.json(
          { error: 'You need an invite link, or must be logged in, to create an account.' },
          { status: 401 }
        );
      }
    }
  }

  try {
    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const user = await createUser(id, username, password);

    if (invite) {
      await markInviteUsed(invite.token, user.username);
    }

    // Auto-login the new account only for the bootstrap case (no users
    // existed yet) or the invite-link case (the person filling out this
    // form IS the one who should end up logged in as the new account).
    // When an already-logged-in user submits this to add someone else,
    // leave their own session untouched — logging in as the new account
    // would silently kick the inviter out of their own session.
    if (!requestingUserId) {
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
