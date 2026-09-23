import { NextResponse } from 'next/server';
import {
  getProfileDataForUser,
  saveProfileDataForUser,
  renameProfileForUser,
  deleteProfileForUser,
  listProfilesForUser,
} from '@/lib/db';

export async function GET(request, { params }) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const data = await getProfileDataForUser(params.id, userId);
    if (!data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load profile data' }, { status: 500 });
  }
}

// Save the full data blob for this profile (appointments, providers, etc.)
export async function PUT(request, { params }) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    await saveProfileDataForUser(params.id, userId, body?.data || {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save profile data' }, { status: 500 });
  }
}

// Rename via PATCH
export async function PATCH(request, { params }) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = (body?.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  try {
    await renameProfileForUser(params.id, userId, name);
    const profiles = await listProfilesForUser(userId);
    return NextResponse.json({ ok: true, profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to rename profile' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const remaining = await listProfilesForUser(userId);
    if (remaining.length <= 1) {
      return NextResponse.json({ error: "Can't delete your only profile" }, { status: 400 });
    }
    await deleteProfileForUser(params.id, userId);
    const profiles = await listProfilesForUser(userId);
    return NextResponse.json({ ok: true, profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
