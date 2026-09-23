import { NextResponse } from 'next/server';
import { listProfiles, createProfile, ensureAtLeastOneProfile } from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  try {
    const profiles = await ensureAtLeastOneProfile();
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 });
  }
}

export async function POST(request) {
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
    await createProfile(id, name);
    const profiles = await listProfiles();
    return NextResponse.json({ id, profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
