import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const raw = sp?.next;
  // 오픈 리다이렉트 방지 — 내부 절대경로만 허용
  const next = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>요기보 통합 대시보드</h1>
        <p className="sub">사내 전용입니다.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
