/**
 * 내부 화면 공통 크롬 — 제목 + 우측 액션.
 * 내비게이션은 좌측 사이드바가 담당하므로 여기엔 두지 않는다.
 */
export default function PageShell({ title, desc, meta, actions, children }) {
  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {desc && <p>{desc}</p>}
          {meta}
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
