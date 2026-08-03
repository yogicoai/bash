/**
 * 대시보드 레지스트리 — 홈 화면의 단일 진실 공급원.
 *
 * status:
 *   'ready'    이관 완료, dash 안에서 동작
 *   'planned'  이관 예정 (Phase 참고)
 *   'external' Cafe24에 그대로 두고 링크만 (Cafe24 상품·쿠폰 API에 물려 있어 이관 대상 아님)
 */

export const GROUPS = [
  {
    id: 'offline',
    title: '오프라인',
    desc: 'deliveryOFF HTML에서 이관',
    items: [
      {
        name: '창고재고',
        href: '/stock/warehouse',
        status: 'ready',
        desc: '매장별 창고 재고 현황',
        source: 'realtime · /api/warehouse-stock',
      },
      {
        name: '영업분석',
        href: '/sales/analysis',
        status: 'ready',
        desc: '기간별 매출·판매 분석 (EPP 별도 분류)',
        source: 'realtime · orders / months / jwasu-table',
      },
      {
        name: '매장별 판매분석',
        href: '/sales/by-store',
        status: 'ready',
        desc: '같은 분석, EPP는 프리미엄에 합산',
        source: 'realtime · orders / months / jwasu-table',
      },
      {
        name: 'Y리그 현황',
        href: '/yleague/status',
        status: 'ready',
        desc: '좌수왕·캐스트·스토어 3종목',
        source: 'realtime · jwasu/dashboard + orders + managers',
      },
      {
        name: 'Y리그 누적랭킹',
        href: '/yleague/ranking',
        status: 'ready',
        desc: '월별 1등 누적 (달성/미달성)',
        source: 'realtime · 월별 dashboard + orders',
      },
      {
        name: '재고관리',
        href: '/stock/manage',
        status: 'planned',
        phase: 4,
        desc: '카테고리별 재고 + 스냅샷',
        source: 'realtime · stock/:category + offorder · snapshot',
      },
      {
        name: '주간보고',
        href: '/weekly',
        status: 'planned',
        phase: 5,
        desc: '주간 종합 보고 (가장 큼)',
        source: 'realtime 전반 + offorder · work-hours',
      },
    ],
  },
  {
    id: 'order',
    title: '오프라인 주문서',
    desc: 'Cafe24 상품·쿠폰 API 연동 — 이관하지 않고 링크로 연결',
    items: [
      {
        name: '오프라인 주문서',
        href: 'https://yogibo.kr/off/order/index.html',
        status: 'external',
        desc: '매장용 주문서',
      },
      {
        name: '주문서 관리자',
        href: 'https://yogibo.kr/off/order/admin.html',
        status: 'external',
        desc: '관리자 화면',
      },
    ],
  },
  {
    id: 'zones',
    title: '다른 대시보드',
    desc: 'Phase 6에서 zone으로 연결 예정',
    items: [
      { name: '온라인 판매분석', href: '/online', status: 'planned', phase: 6, desc: 'onlineData', source: 'Next 14 · MCP 서버 포함' },
      { name: '광고 통합', href: '/marketing', status: 'planned', phase: 6, desc: 'mkboard', source: 'Next 16' },
      { name: '블로그 통계', href: '/blog', status: 'planned', phase: 6, desc: 'BlogData', source: 'Next 16' },
      { name: 'B2B 메일 마케팅', href: '/b2b', status: 'planned', phase: 6, desc: 'mktCl', source: 'Next 16' },
      { name: 'CS 셀프가이드', href: '/cs', status: 'planned', phase: 6, desc: 'cs-self-guide', source: 'Next 16 · TS' },
    ],
  },
];
