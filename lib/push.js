import webpush from 'web-push';

let configured = false;

// Returns a configured web-push client, or null if VAPID keys aren't set.
export function getWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
    configured = true;
  }
  return webpush;
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// Send to one stored subscription. Returns 'ok' | 'gone' | 'error'.
export async function sendPush(wp, sub, payload) {
  try {
    await wp.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 }
    );
    return 'ok';
  } catch (err) {
    if (err?.statusCode === 404 || err?.statusCode === 410) return 'gone';
    console.error('Push send failed:', err?.statusCode, err?.body?.slice?.(0, 200));
    return 'error';
  }
}
