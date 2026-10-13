'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'bloom-trail-install-dismissed';

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

// Registers the service worker and offers a gentle "install" prompt:
// a real install button on Android/desktop Chrome, and a how-to hint on iPhone.
export default function PwaSetup() {
  const [deferred, setDeferred] = useState(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone || safeGet(DISMISS_KEY)) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIOS && isSafari) setIosHint(true);

    function onPrompt(e) { e.preventDefault(); setDeferred(e); }
    function onInstalled() { setDeferred(null); setIosHint(false); }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() { safeSet(DISMISS_KEY, '1'); setDeferred(null); setIosHint(false); }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
  }

  if (!deferred && !iosHint) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Bloom Trail"
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 50, maxWidth: 480, margin: '0 auto',
        background: 'var(--paper-raised, #fff)', color: 'var(--ink, #3a2233)',
        border: '1px solid var(--line, #f0d9e4)', borderRadius: 14, padding: '12px 14px',
        boxShadow: '0 8px 28px rgba(60,20,45,.18)', display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.35 }}>
        <strong>Install Bloom Trail</strong>
        <div style={{ color: 'var(--ink-soft, #7d5f74)' }}>
          {deferred
            ? 'Add it to your home screen for quick, full-screen access.'
            : 'Tap the Share button, then “Add to Home Screen”.'}
        </div>
      </div>
      {deferred && (
        <button type="button" className="primary" onClick={install} style={{ whiteSpace: 'nowrap' }}>Install</button>
      )}
      <button type="button" className="ghost" onClick={dismiss} aria-label="Dismiss" style={{ padding: '6px 10px' }}>✕</button>
    </div>
  );
}
