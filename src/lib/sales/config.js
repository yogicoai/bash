/**
 * 영업분석 / 매장별 판매분석 설정.
 *
 * 원본 deliveryOFF/영업분석.html(131KB)과 매장별판매데이터분석자료.html(134KB)은
 * 20줄만 다른 같은 대시보드다. 그 차이를 여기 두 벌의 설정으로 흡수한다.
 *   · EPP 충전재를 별도 분류할지, 프리미엄에 합산할지
 *   · 커버 색상으로 치지 않는 값 목록
 */

export const CATEGORY_ORDER = ['소파', '바디필로우', '리빙', '케어', '키즈', '기타'];

export const CATEGORY_PALETTE = {
  소파: '#6366f1',
  바디필로우: '#22d3ee',
  리빙: '#f59e0b',
  케어: '#34d399',
  키즈: '#a78bfa',
  기타: '#94a3b8',
};

export const categoryColor = (c) => CATEGORY_PALETTE[c] || '#94a3b8';

/** 정산성 항목·포장재 — 집계 제외 */
const EXCLUDE_PRODUCT_KEYWORDS = ['교환', '차액', '부직포백', 'Delivery Charge', '배송비', '계산실수'];
export function isExcludedProduct(name) {
  const n = String(name || '');
  return EXCLUDE_PRODUCT_KEYWORDS.some((k) => n.includes(k));
}

/** 집계 대상 아닌 매장 — 공백 무시 비교 */
const EXCLUDE_STORES = ['요기보매니저영업'];
export function isExcludedStore(store) {
  const s = String(store || '').replace(/\s+/g, '');
  return EXCLUDE_STORES.some((x) => s === x.replace(/\s+/g, ''));
}

/** 커버 색상이 아닌 값 (KG 단위·메이트류 상품명 등) */
const BASE_COLOR_EXCLUDE = [
  /kg/i, /\d+\s*kg/i, /리필/, /비즈/,
  /나르왈/, /티렉스/, /다육이/, /메이트/,
  /알로에/, /아로/, /우파루파/, /악셀/,
  /산세베리아/, /스프라우트/, /팍스/, /옥토푸스/,
];

/** 색상명 → 스와치 (대표 색만) */
const COLOR_SWATCH = [
  [/(블랙|black|검)/i, '#1f2937'], [/(화이트|white|흰)/i, '#e2e8f0'],
  [/(그레이|gray|grey|회)/i, '#9ca3af'], [/(차콜|charcoal)/i, '#4b5563'],
  [/(네이비|navy|남색)/i, '#1e40af'], [/(블루|blue|파랑|하늘)/i, '#3b82f6'],
  [/(레드|red|빨강|와인|버건디)/i, '#dc2626'], [/(핑크|pink|분홍|로즈)/i, '#ec4899'],
  [/(퍼플|purple|보라|라벤더)/i, '#8b5cf6'], [/(그린|green|초록|민트|올리브|카키)/i, '#16a34a'],
  [/(옐로|yellow|노랑|머스타드)/i, '#eab308'], [/(오렌지|orange|주황|코랄)/i, '#f97316'],
  [/(브라운|brown|갈색|모카|카멜|탄)/i, '#a16207'], [/(베이지|beige|아이보리|크림|샌드)/i, '#d6c3a5'],
  [/(실버|silver)/i, '#cbd5e1'],
];

export function colorSwatch(name) {
  const n = String(name || '');
  for (const [re, hex] of COLOR_SWATCH) if (re.test(n)) return hex;
  return '#64748b';
}

export const KPI_LINES = [
  { key: 'setR', label: '세트구매율', color: '#818cf8', fmt: (v) => v.toFixed(1) + '%' },
  { key: 'coverR', label: '커버구매율', color: '#22d3ee', fmt: (v) => v.toFixed(1) + '%' },
  { key: 'cvr', label: 'CVR', color: '#fb7185', fmt: (v) => v.toFixed(1) + '%' },
  { key: 'aov', label: '객단가', color: '#34d399', fmt: (v) => Math.round(v).toLocaleString() + '원' },
];

const FILL_PALETTE_FULL = {
  스탠다드: '#22d3ee',
  프리미엄: '#f59e0b',
  프리미엄EPP: '#34d399',
  프리미엄플러스: '#a78bfa',
  기타: '#94a3b8',
};

export const VARIANTS = {
  analysis: {
    key: 'analysis',
    title: '영업분석',
    heading: '매장별 판매 데이터 분석',
    csvName: '영업분석',
    mergeEpp: false,
    fillKeys: ['스탠다드', '프리미엄', '프리미엄EPP', '프리미엄플러스', '기타'],
    fillPalette: FILL_PALETTE_FULL,
    colorExclude: BASE_COLOR_EXCLUDE,
    fillNote:
      'X축 = 월, Y축 = 판매비중(%) · 스탠다드 / 프리미엄 / 프리미엄EPP / 프리미엄플러스 충전재의 월별 비중 추이',
  },
  byStore: {
    key: 'byStore',
    title: '매장별 판매분석',
    heading: '매장별 판매 데이터 분석',
    csvName: '매장별판매분석',
    mergeEpp: true,
    fillKeys: ['스탠다드', '프리미엄', '프리미엄플러스', '기타'],
    fillPalette: FILL_PALETTE_FULL,
    colorExclude: [...BASE_COLOR_EXCLUDE, /유니콘/, /도그/],
    fillNote:
      'X축 = 월, Y축 = 판매비중(%) · 스탠다드 / 프리미엄 / 프리미엄플러스 충전재의 월별 비중 추이 (EPP는 프리미엄에 합산)',
  },
};

/** 색상값이 커버 색상이 아닌지 — variant마다 제외 목록이 다르다 */
export function makeIsNonColor(variant) {
  return (name) => {
    const n = String(name || '').trim();
    if (!n || n === '기타' || n === '.' || n === '-') return true;
    return variant.colorExclude.some((re) => re.test(n));
  };
}
