'use client';

import { useState } from 'react';

export default function LoginForm({ next = '/' }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.error || '로그인에 실패했습니다.');
        setBusy(false);
        return;
      }
      // 쿠키가 심긴 뒤 서버 컴포넌트를 다시 태우기 위해 전체 이동
      window.location.href = next;
    } catch {
      setError('서버에 연결할 수 없습니다.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="error">{error}</div>}
      <label className="field">
        <span>비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy || !password}>
        {busy ? '확인 중…' : '로그인'}
      </button>
    </form>
  );
}
