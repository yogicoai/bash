import LogoutButton from './LogoutButton';
import { GROUPS } from '@/lib/links';

const TAG = {
  ready: { cls: 'tag-ready', label: '사용 가능' },
  external: { cls: 'tag-external', label: '외부 링크' },
  planned: { cls: 'tag-planned', label: '준비 중' },
};

function Card({ item }) {
  const tag = TAG[item.status] ?? TAG.planned;
  const clickable = item.status === 'ready' || item.status === 'external';

  const body = (
    <>
      <div className="card-title">
        <strong>{item.name}</strong>
        <span className={`tag ${tag.cls}`}>
          {item.status === 'planned' && item.phase ? `Phase ${item.phase}` : tag.label}
        </span>
      </div>
      {item.desc && <div className="card-desc">{item.desc}</div>}
      {item.source && <div className="card-source">{item.source}</div>}
    </>
  );

  if (!clickable) return <div className="card card-muted">{body}</div>;

  const external = item.status === 'external';
  return (
    <a
      className="card card-link"
      href={item.href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {body}
    </a>
  );
}

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>요기보 통합 대시보드</h1>
          <span>Phase 0 — 셸</span>
        </div>
        <LogoutButton />
      </header>

      {GROUPS.map((group) => (
        <section className="group" key={group.id}>
          <div className="group-head">
            <h2>{group.title}</h2>
            <p>{group.desc}</p>
          </div>
          <div className="grid">
            {group.items.map((item) => (
              <Card key={item.name} item={item} />
            ))}
          </div>
        </section>
      ))}

      <p className="footnote">
        원천 API(realtime · offorder)는 브라우저에서 직접 호출하지 않습니다.
        모든 요청은 <code>/api/rt/*</code> · <code>/api/off/*</code> 서버사이드 프록시를 거칩니다.
      </p>
    </main>
  );
}
