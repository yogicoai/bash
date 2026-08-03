/**
 * 대시보드 레지스트리 — 홈 화면의 단일 진실 공급원.
 *
 * 최상위는 업무 도메인으로만 나눈다: 오프라인 · 영업 · 온라인 · 마케팅 · B2B · CS.
 * 이관된 화면인지 독립 앱인지는 카드의 status로 구분한다.
 *
 * status:
 *   'ready'    dash 안에서 동작
 *   'planned'  이관/연결 예정 (phase 참고)
 *   'external' Cafe24에 그대로 두고 링크만 (Cafe24 API에 물려 있어 이관 대상 아님)
 */

export const GROUPS = [
  {
    id: 'offline',
    title: '오프라인',
    desc: '매장·물류 재고와 주문서',
    items: [
      {
        name: '매장 창고재고',
        href: '/stock/warehouse',
        status: 'ready',
        desc: '매장 뒤 창고의 재고 현황 (매장별)',
        source: 'realtime · /api/warehouse-stock',
      },
      {
        name: '물류센터 재고',
        href: '/stock/center',
        status: 'planned',
        phase: 4,
        desc: '물류센터 창고 재고 · 카테고리별 + 일자별 스냅샷',
        source: 'realtime · stock/:category + offorder · snapshot',
      },
      {
        name: '오프라인 주문서',
        href: 'https://yogibo.kr/off/order/index.html',
        status: 'external',
        desc: '매장용 주문서 · Cafe24 상품·쿠폰 API 연동',
      },
      {
        name: '주문서 관리자',
        href: 'https://yogibo.kr/off/order/admin.html',
        status: 'external',
        desc: '주문서 관리자 화면',
      },
    ],
  },
  {
    id: 'sales',
    title: '영업',
    desc: '판매 실적 분석과 매장 리그',
    items: [
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
    id: 'online',
    title: '온라인',
    desc: 'Cafe24 · 스마트스토어 판매',
    items: [
      {
        name: '온라인 판매분석',
        href: '/online',
        status: 'planned',
        phase: 6,
        desc: '유입·회원/비회원·쿠폰 프로모션 분석',
        source: 'onlineData · Next 14 + MCP 서버',
      },
    ],
  },
  {
    id: 'marketing',
    title: '마케팅',
    desc: '광고 집행과 콘텐츠 성과',
    items: [
      {
        name: '광고 통합',
        href: '/marketing/ads',
        status: 'planned',
        phase: 6,
        desc: '네이버SA · META · 카카오모먼트 + 유입·매출(UTM)',
        source: 'mkboard · Next 16',
      },
      {
        name: '블로그 통계',
        href: '/marketing/blog',
        status: 'planned',
        phase: 6,
        desc: '네이버 블로그 통계 시각화',
        source: 'BlogData · Next 16',
      },
    ],
  },
  {
    id: 'b2b',
    title: 'B2B',
    desc: '기업 대상 영업·마케팅',
    items: [
      {
        name: 'B2B 메일 마케팅',
        href: '/b2b',
        status: 'planned',
        phase: 6,
        desc: '키워드 크롤링 → AI 검증 → 승인 → 발송',
        source: 'mktCl · Next 16',
      },
    ],
  },
  {
    id: 'cs',
    title: 'CS',
    desc: '고객 응대',
    items: [
      {
        name: 'CS 셀프가이드',
        href: '/cs',
        status: 'planned',
        phase: 6,
        desc: '상담 응대 가이드',
        source: 'cs-self-guide · Next 16 + TS',
      },
    ],
  },
];
