import { NextResponse } from 'next/server';
import { listProfilesForUser, createProfileForUser, ensureAtLeastOneProfileForUser } from '@/lib/db';

export async function GET(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const profiles = await ensureAtLeastOneProfileForUser(userId);
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = (body?.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const id = crypto.randomUUID();
    await createProfileForUser(id, userId, name);
    const profiles = await listProfilesForUser(userId);
    return NextResponse.json({ id, profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
