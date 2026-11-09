'use client';

import { useState } from 'react';

// Only same-site paths are allowed as ?next= targets, so the form can't be used as an open redirect.
function nextPath() {
  const next = new URLSearchParams(window.location.search).get('next') || '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không đăng nhập được.');
      window.location.replace(nextPath());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <div className="home-brand">
        <img src="/brand/avepoint.svg" alt="AvePoint" width="185" height="32" />
      </div>
      <h1>Quay Số May Mắn</h1>
      <form className="login-card" onSubmit={submit}>
        <label className="field"><span>Email</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="field"><span>Mật khẩu</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="btn gold" type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </main>
  );
}
