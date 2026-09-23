'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (resp.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await resp.json().catch(() => ({}));
        setError(data.error || 'Incorrect PIN');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--paper)',
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="panel"
        style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}
      >
        <svg width="56" height="56" viewBox="60 150 520 380" style={{ margin: '0 auto 12px' }} aria-hidden="true">
          <path d="M 320 480 C 260 460, 195 400, 190 320 C 187 260, 225 210, 275 205 C 320 201, 350 235, 345 280 C 342 315, 315 335, 320 480 Z" fill="none" stroke="#c85c8e" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M 320 480 C 330 335, 303 315, 300 280 C 295 235, 325 201, 370 205 C 420 210, 458 260, 455 320 C 450 400, 385 460, 320 480 Z" fill="none" stroke="#c85c8e" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M 320 480 L 320 300" fill="none" stroke="#e0435f" strokeWidth="17" strokeLinecap="round"/>
          <path d="M 320 380 C 350 372, 368 350, 362 328" fill="none" stroke="#e0435f" strokeWidth="13" strokeLinecap="round"/>
        </svg>
        <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--rose-deep)', margin: '0 0 4px' }}>
          Bloom Trail
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
          Enter your PIN to continue
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, marginBottom: 12 }}
        />
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}
        <button type="submit" className="primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
