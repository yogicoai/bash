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

import { ZONES } from './zones';

export const GROUPS = [
  {
    id: 'offline',
    title: '오프라인',
    icon: '🏬',
    desc: '매장 운영 시스템과 매장 리그',
    items: [
      {
        name: '매장직원 통합관리',
        href: 'https://yogibo.kr/off/admin.html',
        slug: 'store-staff',
        icon: '👥',
        status: 'external',
        desc: '오프라인 매장 매니저 통합관리센터',
      },
      {
        name: '오프라인 매출 시스템',
        href: 'https://yogibo.kr/off/index.html',
        slug: 'offline-admin',
        icon: '📋',
        status: 'external',
        desc: '오프라인 매장 매출 관리 · 주간보고 통합관리',
      },
      {
        name: 'Y리그 현황',
        href: '/yleague/status',
        icon: '🏆',
        status: 'ready',
        desc: '좌수왕·캐스트·스토어 3종목',
        source: 'realtime · jwasu/dashboard + orders + managers',
      },
      {
        name: 'Y리그 누적랭킹',
        href: '/yleague/ranking',
        icon: '🥇',
        status: 'ready',
        desc: '월별 1등 누적 (달성/미달성)',
        source: 'realtime · 월별 dashboard + orders',
      },
    ],
  },
  {
    id: 'order',
    title: '오프라인 주문서',
    icon: '🧾',
    desc: 'Cafe24 상품·쿠폰 API 연동 — 매장 주문 작성과 관리',
    items: [
      {
        name: '오프라인 주문서',
        href: 'https://yogibo.kr/off/order/index.html',
        slug: 'order',
        icon: '🧾',
        status: 'external',
        desc: '매장용 주문서 · Cafe24 상품·쿠폰 API 연동',
      },
      {
        name: '오프라인 주문서 관리자',
        href: 'https://yogibo.kr/off/order/admin.html',
        slug: 'order-admin',
        icon: '⚙️',
        status: 'external',
        desc: '주문서 관리자 화면',
      },
    ],
  },
  {
    id: 'stock',
    title: '재고',
    icon: '📦',
    desc: '물류센터와 매장 창고 재고',
    items: [
      {
        name: '물류센터 재고',
        href: '/stock/center',
        icon: '🏭',
        status: 'ready',
        desc: '물류센터 창고 재고 · 분류별 + 일자별 스냅샷',
        source: 'realtime · stock/:category + offorder · snapshot',
      },
      {
        name: '매장 창고재고',
        href: '/stock/warehouse',
        icon: '📦',
        status: 'ready',
        desc: '매장 뒤 창고의 재고 현황 (매장별)',
        source: 'realtime · /api/warehouse-stock',
      },
    ],
  },
  {
    id: 'sales',
    title: '영업',
    icon: '📈',
    desc: '판매 실적 분석',
    items: [
      {
        name: '영업분석',
        href: '/sales/analysis',
        icon: '📊',
        status: 'ready',
        desc: '기간별 매출·판매 분석 · 탭 10종',
        source: 'realtime · orders / months / jwasu-table',
      },
      {
        name: '매장매니저 스케줄 관리',
        href: 'https://yogibo.kr/off/staff/schedule.html',
        slug: 'staff-schedule',
        icon: '📅',
        status: 'external',
        desc: '매장 매니저 근무·시차 캘린더',
      },
      {
        name: '수습직원 평가',
        href: ZONES.evaluation,
        slug: 'zone-evaluation',
        icon: '📝',
        status: 'external',
        desc: '수습직원 시험 + 종합평가 (인사·매출·역량)',
        source: 'evaluation · Next',
      },
    ],
  },
  {
    id: 'online',
    icon: '🛒',
    title: '온라인',
    desc: 'Cafe24 · 스마트스토어(실시간 API) + 외부몰(이카운트 매출) 기반',
    items: [
      {
        name: '온라인 판매분석',
        href: ZONES.online,
        slug: 'zone-online',
        icon: '🛍️',
        status: 'external',
        desc: '기간별 판매 분석 · 재취합/재동기화',
        source: 'onlineData · Next 14 + MCP 서버',
      },
      {
        name: '온라인 일일매출',
        href: ZONES.onlineReport,
        slug: 'zone-online-report',
        dated: true,
        icon: '📅',
        status: 'external',
        desc: '그날 날짜 기준 일일매출 리포트',
        source: 'onlineData · /api/report?date=오늘',
      },
    ],
  },
  {
    id: 'marketing',
    icon: '📣',
    title: '마케팅',
    desc: '광고 집행과 콘텐츠 성과',
    items: [
      {
        name: '광고 통합',
        href: ZONES.ads,
        slug: 'zone-ads',
        icon: '📢',
        status: 'external',
        desc: '광고효율 · 유입·매출(UTM) · CSV · 60초 자동갱신',
        source: 'mkboard · Next 16',
      },
      {
        name: '블로그 통계',
        href: ZONES.blog,
        slug: 'zone-blog',
        icon: '📝',
        status: 'external',
        desc: '유입 분석 · 사용자 행동 · 게시물 순위 · 데이터 업로드',
        source: 'BlogData · Next 16',
      },
    ],
  },
  {
    id: 'b2b',
    icon: '🤝',
    title: 'B2B',
    desc: '기업 대상 영업·마케팅',
    items: [
      {
        name: 'B2B 메일 마케팅',
        href: ZONES.b2b,
        slug: 'zone-b2b',
        icon: '📧',
        status: 'external',
        desc: '크롤링 → 검토·승인 → 발송 리스트 → 예약 발송',
        source: 'mktCl · Next 16',
      },
    ],
  },
  {
    id: 'cs',
    icon: '💬',
    title: 'CS',
    desc: '고객 응대',
    items: [
      {
        name: 'CS 셀프가이드',
        href: ZONES.cs,
        slug: 'zone-cs',
        icon: '🎧',
        status: 'external',
        desc: '배송 · 교환/환불 · A/S 상담 셀프 가이드',
        source: 'cs-self-guide · Next 16 + TS',
      },
    ],
  },,
  {
    id: 'design',
    title: '디자인',
    icon: '🎨',
    desc: '배너·페이지 제작 도구',
    items: [
      {
        name: '디자인 빌더',
        href: ZONES.design,
        slug: 'zone-design',
        icon: '🖌️',
        status: 'external',
        desc: 'AI 프롬프트 생성 · 배너/이벤트 페이지 빌더 · 제품·레퍼런스 라이브러리',
        source: 'design-t-omega · Next',
      },
    ],
  },
  {
    id: 'data',
    title: '데이터',
    icon: '🗄️',
    desc: '원장 내려받기와 Claude(MCP) 연결',
    items: [
      {
        name: '데이터 내려받기',
        href: '/data',
        icon: '📥',
        status: 'ready',
        desc: '오프라인 매출·Y리그·재고를 CSV/JSON으로 · MCP 연결 안내',
        source: 'realtime · orders / jwasu / stock',
      },
    ],
  },
];
