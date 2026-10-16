'use client';

import { useEffect, useState } from 'react';

const KEY = 'bloom-trail-theme';
const COLORS = { light: '#c85c8e', dark: '#241621' };

function readSaved() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}

function apply(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
  try { if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch {}

  // Keep the phone's browser bar / status bar colour in step with the choice.
  const effective = mode === 'auto'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = COLORS[effective];
  document.head.appendChild(meta);
}

const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
const LABEL = { auto: '🖥 Auto', light: '☀️ Light', dark: '🌙 Dark' };

export default function ThemeToggle() {
  const [mode, setMode] = useState('auto');

  useEffect(() => { setMode(readSaved()); }, []);

  // While in Auto, follow the phone/computer setting live.
  useEffect(() => {
    if (mode !== 'auto' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('auto');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [mode]);

  function cycle() {
    const next = NEXT[mode];
    setMode(next);
    apply(next);
  }

  return (
    <button
      type="button"
      className="ghost"
      onClick={cycle}
      style={{ fontSize: 12, padding: '6px 10px', whiteSpace: 'nowrap' }}
      title={`Appearance: ${mode}. Click to switch (Auto → Light → Dark).`}
      aria-label={`Appearance: ${mode}. Click to change.`}
    >
      {LABEL[mode]}
    </button>
  );
}
