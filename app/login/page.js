'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ username, password }),
      });
      if (resp.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await resp.json().catch(() => ({}));
        setError(data.error || 'Incorrect username or password');
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
        <img
          src="/logo.png"
          alt="Bloom Trail"
          style={{ height: 90, width: 'auto', margin: '0 auto 12px', display: 'block' }}
        />
        <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--rose-deep)', margin: '0 0 4px' }}>
          Bloom Trail
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
          Log in to your journey
        </p>
        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <label>Username</label>
          <input
            type="text"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}
        <button type="submit" className="primary" style={{ width: '100%', marginBottom: 12 }} disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
          No account yet? <Link href="/signup" style={{ color: 'var(--rose-deep)' }}>Set one up</Link>
        </p>
      </form>
    </div>
  );
}
