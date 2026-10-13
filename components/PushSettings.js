'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function tzName() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

async function postSubscription(sub) {
  const resp = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), tz: tzName() }),
  });
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({}));
    throw new Error(j.error || 'Could not save notification settings');
  }
}

// status: loading | unsupported | needs-install | blocked | off | on
export default function PushSettings() {
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const ua = navigator.userAgent;
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) { setStatus(isIOS && !standalone ? 'needs-install' : 'unsupported'); return; }
      if (Notification.permission === 'denied') { setStatus('blocked'); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub && Notification.permission === 'granted') {
          setStatus('on');
          postSubscription(sub).catch(() => {}); // keep this device's time zone fresh
        } else {
          setStatus('off');
        }
      } catch { setStatus('off'); }
    })();
  }, []);

  async function enable() {
    setBusy(true); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus(perm === 'denied' ? 'blocked' : 'off'); return; }
      const keyResp = await fetch('/api/push/key');
      const keyJson = await keyResp.json();
      if (!keyResp.ok) throw new Error(keyJson.error || 'Notifications are not available right now');
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
        });
      }
      await postSubscription(sub);
      setStatus('on');
      setMsg('Notifications are on for this device.');
    } catch (e) {
      setMsg(e.message || 'Could not turn on notifications.');
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg('');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
      setMsg('Notifications are off for this device.');
    } catch { setMsg('Could not turn off notifications.'); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setMsg('');
    try {
      const resp = await fetch('/api/push/test', { method: 'POST' });
      const j = await resp.json().catch(() => ({}));
      setMsg(resp.ok ? 'Test sent — it should appear in a moment.' : (j.error || 'Test failed.'));
    } catch { setMsg('Test failed.'); }
    finally { setBusy(false); }
  }

  if (status === 'loading') return null;

  const note = {
    unsupported: 'This browser can’t show notifications. Try Chrome or Safari, or use “Add to Calendar” for phone alerts.',
    'needs-install': 'On iPhone, first add Bloom Trail to your Home Screen (Share → Add to Home Screen), then open it from there to turn on notifications.',
    blocked: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.',
    off: 'Get a notification at the time you set on a reminder, and one hour before appointments that have a time.',
    on: 'You’ll be notified at the time set on each reminder, and one hour before appointments that have a time.',
  }[status];

  return (
    <div className="section-note" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 12 }}>
      <span aria-hidden style={{ fontSize: 18 }}>{status === 'on' ? '🔔' : '🔕'}</span>
      <div style={{ flex: 1, minWidth: 200, fontSize: 13, lineHeight: 1.4 }}>
        <strong>Notifications {status === 'on' ? 'on' : 'off'}</strong>
        <div style={{ color: 'var(--ink-soft)' }}>{note}</div>
        {msg && <div role="status" style={{ marginTop: 4 }}>{msg}</div>}
      </div>
      {status === 'off' && <button type="button" className="primary" disabled={busy} onClick={enable}>Turn on</button>}
      {status === 'on' && (
        <>
          <button type="button" className="ghost" disabled={busy} onClick={sendTest}>Send test</button>
          <button type="button" className="ghost" disabled={busy} onClick={disable}>Turn off</button>
        </>
      )}
    </div>
  );
}
