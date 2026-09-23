'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      // If this was the first-ever account, the server already logged us
      // in and set the session cookie — go straight into the app.
      // Otherwise (an existing user adding someone else), just confirm.
      const meResp = await fetch('/api/data/profiles');
      if (meResp.ok) {
        router.push('/');
        router.refresh();
      } else {
        setSuccess(`Account "${data.username}" created. They can now log in with their own password.`);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
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
        style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}
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
          Set up an account
        </p>
        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <label>Username</label>
          <input
            type="text"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="At least 3 characters"
          />
        </div>
        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <label>Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}
        {success && (
          <p style={{ color: 'var(--rose-deep)', fontSize: 13, marginBottom: 12 }}>{success}</p>
        )}
        <button type="submit" className="primary" style={{ width: '100%', marginBottom: 12 }} disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--rose-deep)' }}>Log in</Link>
        </p>
      </form>
    </div>
  );
}
