'use client';

import { useEmbed } from './EmbedModal';
import { popupHref } from './ViewMode';
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
 * 배지는 우측 상단에 나란히 붙는다.
 *   kind   — 무엇을 하는 화면인가 (예: 시스템설정). 있을 때만.
 *   guide  — 사용 설명서가 있으면 📖. 눌러도 화면이 아니라 설명서만 열린다.
 *   status — 어떻게 열리는가 (팝업 / 사용 가능 / 준비 중).
 * 같은 그룹 안에서도 "설정하는 곳"과 "보는 곳"을 눌러보기 전에 구분하려는 것이다.
 *
 * 배지 줄은 카드 안이 아니라 바깥(.card-slot)에 겹쳐 둔다 — 카드가 button/a 라서
 * 그 안에 또 버튼(📖)을 넣을 수 없기 때문이다. 배지 줄 자체는 클릭을 통과시키고
 * 📖 만 클릭을 받으므로, 배지 위를 눌러도 카드가 열리는 동작은 그대로다.
 */
export default function DashCard({ item }) {
  const { open } = useEmbed();
  const tag = TAG[item.status] ?? TAG.planned;

  const tags = (
    <span className="card-tags">
      {item.kind && <span className="tag tag-kind">{item.kind}</span>}
      {item.guide && (
        <button
          type="button"
          className="tag tag-guide"
          title={`${item.name} 사용 설명서`}
          aria-label={`${item.name} 사용 설명서`}
          onClick={() =>
            open({
              ...item,
              name: `${item.name} 사용 설명서`,
              desc: '사용 설명서',
              icon: '📖',
              href: item.guide,
              windowOnly: false,
            })
          }
        >
          {/* 이모지가 안 뜨는 환경이 있어 글자를 같이 둔다 */}
          📖 설명서
        </button>
      )}
      <span className={`tag ${tag.cls}`}>
        {item.status === 'planned' && item.phase ? `Phase ${item.phase}` : tag.label}
      </span>
    </span>
  );

  const body = (
    <>
      {item.icon && <span className="card-icon">{item.icon}</span>}
      <strong className="card-name">{item.name}</strong>
      {item.desc && <span className="card-desc">{item.desc}</span>}
      {item.source && <span className="card-source">{item.source}</span>}
    </>
  );

  const slot = (card) => (
    <div className="card-slot">
      {card}
      {tags}
    </div>
  );

  if (item.status === 'planned') return slot(<div className="card card-muted">{body}</div>);

  // 카드는 예외 없이 팝업으로 연다 — 어떤 카드는 페이지가 바뀌고 어떤 카드는
  // 팝업이 뜨면 눌러보기 전엔 알 수 없다. 화면 사이를 오가는 이동은 사이드바가 맡는다.
  return slot(
    <button
      type="button"
      className="card card-link"
      onClick={() => open({ ...item, href: popupHref(resolveHref(item)) })}
    >
      {body}
    </button>,
  );
}
