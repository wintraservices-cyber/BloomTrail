import { NextResponse } from 'next/server';
import { createInvite, listInvitesForUser, deleteInvite } from '@/lib/db';
import crypto from 'crypto';

const INVITE_TTL_DAYS = 7;

export async function GET(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const invites = await listInvitesForUser(userId);
    return NextResponse.json({ invites });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load invites' }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    // A long random token — this is the entire security of the invite
    // link, so it needs to be unguessable, not just unique.
    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await createInvite(token, userId, expiresAt);
    const invites = await listInvitesForUser(userId);
    return NextResponse.json({ token, expiresAt: expiresAt.toISOString(), invites });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const token = body?.token;
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

  try {
    await deleteInvite(token, userId);
    const invites = await listInvitesForUser(userId);
    return NextResponse.json({ ok: true, invites });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
  }
}
