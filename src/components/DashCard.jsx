'use client';

import { useEmbed } from './EmbedModal';

const TAG = {
  ready: { cls: 'tag-ready', label: '사용 가능' },
  external: { cls: 'tag-external', label: '팝업' },
  planned: { cls: 'tag-planned', label: '준비 중' },
};

/** 홈 카드 — 내부 화면은 이동, 외부 화면은 팝업(iframe)으로 연다 */
export default function DashCard({ item }) {
  const { open } = useEmbed();
  const tag = TAG[item.status] ?? TAG.planned;

  const body = (
    <>
      <div className="card-title">
        {item.icon && <span className="card-icon">{item.icon}</span>}
        <strong>{item.name}</strong>
        <span className={`tag ${tag.cls}`}>
          {item.status === 'planned' && item.phase ? `Phase ${item.phase}` : tag.label}
        </span>
      </div>
      {item.desc && <div className="card-desc">{item.desc}</div>}
      {item.source && <div className="card-source">{item.source}</div>}
    </>
  );

  if (item.status === 'planned') return <div className="card card-muted">{body}</div>;

  if (item.slug) {
    return (
      <button type="button" className="card card-link" onClick={() => open(item)}>
        {body}
      </button>
    );
  }

  const newTab = item.status === 'external';
  return (
    <a className="card card-link" href={item.href} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {body}
    </a>
  );
}
