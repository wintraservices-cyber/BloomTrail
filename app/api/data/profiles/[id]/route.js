import { NextResponse } from 'next/server';
import { getProfileData, saveProfileData, renameProfile, deleteProfile, listProfiles } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const data = await getProfileData(params.id);
    if (!data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load profile data' }, { status: 500 });
  }
}

// Save the full data blob for this profile (appointments, providers, etc.)
export async function PUT(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    await saveProfileData(params.id, body?.data || {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save profile data' }, { status: 500 });
  }
}

// Rename via PATCH
export async function PATCH(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = (body?.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  try {
    await renameProfile(params.id, name);
    const profiles = await listProfiles();
    return NextResponse.json({ ok: true, profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to rename profile' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const remaining = await listProfiles();
    if (remaining.length <= 1) {
      return NextResponse.json({ error: "Can't delete your only profile" }, { status: 400 });
    }
    await deleteProfile(params.id);
    const profiles = await listProfiles();
    return NextResponse.json({ ok: true, profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
