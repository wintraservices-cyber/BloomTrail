import { NextResponse } from 'next/server';
import { getWebPush, sendPush } from '@/lib/push';
import { listPushSubscriptionsForUser, deletePushSubscriptionByEndpoint } from '@/lib/db';

export async function POST(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const wp = getWebPush();
  if (!wp) return NextResponse.json({ error: 'Notifications are not set up on the server yet.' }, { status: 503 });

  try {
    const subs = await listPushSubscriptionsForUser(userId);
    if (subs.length === 0) return NextResponse.json({ error: 'No device is subscribed yet.' }, { status: 404 });
    let sent = 0;
    for (const s of subs) {
      const r = await sendPush(wp, s, { title: 'Bloom Trail', body: 'Notifications are working 🌸', url: '/' });
      if (r === 'ok') sent++;
      if (r === 'gone') await deletePushSubscriptionByEndpoint(s.endpoint);
    }
    if (sent === 0) return NextResponse.json({ error: 'The notification could not be delivered. Try turning notifications off and on again.' }, { status: 502 });
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Something went wrong sending the test.' }, { status: 500 });
  }
}
