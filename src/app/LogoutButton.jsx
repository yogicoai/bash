'use client';

export default function LogoutButton() {
  async function onClick() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <button type="button" className="btn" onClick={onClick}>
      로그아웃
    </button>
  );
}
