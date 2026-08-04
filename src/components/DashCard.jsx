'use client';

import { useEmbed } from './EmbedModal';
import { popupHref, useViewMode } from './ViewMode';
import { resolveHref } from '@/lib/zones';

const TAG = {
  ready: { cls: 'tag-ready', label: '사용 가능' },
  external: { cls: 'tag-external', label: '팝업' },
  planned: { cls: 'tag-planned', label: '준비 중' },
};

/**
 * 홈 카드 — 디자인 레퍼런스 구성 그대로.
 * 아이콘이 위에 한 줄, 배지는 우측 상단 코너, 그 아래 제목·설명.
 * 내부 화면은 이동, 외부 화면은 팝업(iframe)으로 연다.
 *
 * 배지는 두 가지가 나란히 붙는다.
 *   kind   — 무엇을 하는 화면인가 (예: 시스템설정). 있을 때만.
 *   status — 어떻게 열리는가 (팝업 / 사용 가능 / 준비 중).
 * 같은 그룹 안에서도 "설정하는 곳"과 "보는 곳"을 눌러보기 전에 구분하려는 것이다.
 */
export default function DashCard({ item }) {
  const { open } = useEmbed();
  const { mode } = useViewMode();
  const tag = TAG[item.status] ?? TAG.planned;

  const body = (
    <>
      <span className="card-tags">
        {item.kind && <span className="tag tag-kind">{item.kind}</span>}
        <span className={`tag ${tag.cls}`}>
          {item.status === 'planned' && item.phase ? `Phase ${item.phase}` : tag.label}
        </span>
      </span>
      {item.icon && <span className="card-icon">{item.icon}</span>}
      <strong className="card-name">{item.name}</strong>
      {item.desc && <span className="card-desc">{item.desc}</span>}
      {item.source && <span className="card-source">{item.source}</span>}
    </>
  );

  if (item.status === 'planned') return <div className="card card-muted">{body}</div>;

  // 외부 화면은 항상 팝업. 한 페이지 모드에서는 내부 화면도 팝업으로 띄운다.
  const asPopup = item.slug || mode === 'popup';
  if (asPopup) {
    return (
      <button
        type="button"
        className="card card-link"
        onClick={() => open({ ...item, href: popupHref(resolveHref(item)) })}
      >
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
