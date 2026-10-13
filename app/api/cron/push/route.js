import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  listAllPushSubscriptions, getAllProfilesForUser, claimPushKey, releasePushKey,
  prunePushLog, deletePushSubscriptionByEndpoint,
} from '@/lib/db';
import { getWebPush, sendPush } from '@/lib/push';
import { dueNotifications } from '@/lib/push-schedule';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Called every few minutes by a scheduler (GitHub Actions or Vercel Cron).
export async function GET(request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const wp = getWebPush();
  if (!wp) return NextResponse.json({ error: 'VAPID keys are not set' }, { status: 500 });

  const now = new Date();
  let sent = 0;
  try {
    const all = await listAllPushSubscriptions();
    const byUser = new Map();
    for (const s of all) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id).push(s);
    }

    for (const [userId, subs] of byUser) {
      const tz = subs[0].tz || 'UTC'; // most recently used device decides "local time"
      const profiles = await getAllProfilesForUser(userId);
      const due = dueNotifications(profiles, now, tz);
      for (const n of due) {
        const key = `${userId}:${n.key}`;
        if (!(await claimPushKey(key))) continue; // already sent today
        let delivered = false;
        for (const s of subs) {
          const r = await sendPush(wp, s, { title: n.title, body: n.body, url: n.url, tag: n.key });
          if (r === 'ok') { delivered = true; sent++; }
          if (r === 'gone') await deletePushSubscriptionByEndpoint(s.endpoint);
        }
        // If nothing got through, free the key so the next run can retry.
        if (!delivered) await releasePushKey(key);
      }
    }
    await prunePushLog();
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error('Cron push failed:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
