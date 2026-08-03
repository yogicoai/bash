import Link from 'next/link';

/**
 * 내부 화면 공통 크롬 — 홈 복귀 + 제목 + 우측 액션/메타.
 * 이관되는 7개 화면이 전부 이걸 쓴다.
 */
export default function PageShell({ title, meta, actions, children, wide = false }) {
  return (
    <main className={`shell ${wide ? 'shell-wide' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <Link href="/" className="back">
            ← 대시보드
          </Link>
          <h1>{title}</h1>
          {meta}
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
