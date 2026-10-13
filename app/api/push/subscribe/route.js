import { NextResponse } from 'next/server';
import { savePushSubscription, deletePushSubscriptionForUser } from '@/lib/db';

export async function POST(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !/^https:\/\//.test(sub.endpoint)) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  let tz = typeof body.tz === 'string' ? body.tz : 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { tz = 'UTC'; }

  try {
    await savePushSubscription(userId, sub, tz);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Could not save notification settings' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!body?.endpoint) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    await deletePushSubscriptionForUser(userId, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Could not update notification settings' }, { status: 500 });
  }
}
