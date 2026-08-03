/**
 * Y리그 노출 보정 규칙.
 *
 * ⚠ 이 파일이 Phase 3의 핵심이다.
 * onlineData/lib/jwasuLeague.js는 원천 집계만 하기 때문에 화면 숫자와 다르다.
 * 실제 Y리그 화면의 보정은 deliveryOFF/Y리그현황.html·Y리그 누적랭킹.html 안에만 있었고,
 * 그걸 여기로 옮겼다. 규칙이 바뀌면 여기만 고치면 된다.
 *
 * 각 규칙은 원본 주석의 사유를 그대로 보존한다 — 나중에 걷어낼 수 있는지 판단하려면 사유가 필요하다.
 */

export const JWASU_ROLES = ['부매니저', '시니어', '일급제', '중간관리', '매니저'];
export const CAST_ROLES = ['매니저', '부매니저', '시니어', '일급제'];

/** 누적랭킹이 순회하는 연도 — 원본이 2026으로 하드코딩돼 있었다. 해가 바뀌면 여기를 고친다. */
export const LEAGUE_YEAR = 2026;

/** 매니저영업 프록시 매장 — 이 매장 주문은 담당자의 등록 매장으로 재배치 */
export const SALES_PROXY_STORE = '요기보매니저영업';

const strip = (s) => String(s || '').replace(/\s+/g, '');

// ── 1. 매장별 노출 화이트리스트 ───────────────────────────────
//    지정 매장은 명단 인원만 노출(나머지 전부 숨김).
//    예) 하남스타필드는 한철우만 Y리그(좌수왕/캐스트)에 노출
const STORE_WHITELIST = {
  하남스타필드: ['한철우'],
};

export function isAllowedInStore(name, store) {
  const sN = strip(store);
  const nN = strip(name);
  for (const key in STORE_WHITELIST) {
    if (sN.includes(strip(key))) return STORE_WHITELIST[key].some((a) => strip(a) === nN);
  }
  return true; // 화이트리스트에 없는 매장은 전원 허용
}

// ── 2. 근무지 이동 분리 ──────────────────────────────────────
//    조혜빈: 6/26 기준 분리. 관리자 매장명 설정 문제로 주문이 매장을 구분하지 못해 날짜로 강제 분리.
//      · 6/26 이전(<)  → 신세계본점
//      · 6/26 이후(>=) → 현대무역센터
const STORE_SPLIT_RULES = [
  { name: '조혜빈', cutoffDate: '2026-06-26', beforeStore: '신세계본점', afterStore: '현대무역센터' },
];

export function resolveSplitStore(name, orderDate, defaultStore) {
  const rule = STORE_SPLIT_RULES.find((r) => r.name === String(name || '').trim());
  if (!rule) return defaultStore;
  const d = String(orderDate || '').slice(0, 10);
  if (!d) return defaultStore;
  return d >= rule.cutoffDate ? rule.afterStore : rule.beforeStore;
}

// ── 3. 프록시 매장 재배치 ────────────────────────────────────
//    요기보매니저영업으로 잡힌 주문을 담당 매니저의 "등록 매장" 매출로 귀속.
//    이름으로 등록 매장을 못 찾으면 원본 유지.
export function resolveProxyStore(shortName, orderStore, mgrMap) {
  if (strip(orderStore) !== strip(SALES_PROXY_STORE)) return orderStore;
  const info = mgrMap?.[`_name_${String(shortName || '').trim()}`];
  return info?.storeName || orderStore;
}

// ── 4. 좌수 수기 보정 ────────────────────────────────────────
//    관리자 매장 오설정 보정 — 조혜빈은 신세계본점·현대무역센터를 "동명이인"으로 따로 집계해야 하나,
//    대시보드가 좌수를 현대무역센터로 몰아넣고 신세계본점을 0으로 잡음 → 실제 좌수로 교체(2026-06 한정).
const COUNT_OVERRIDES = [
  { name: '조혜빈', store: '신세계본점', count: 116, period: '2026-06' },
  { name: '조혜빈', store: '현대무역센터', count: 66, period: '2026-06' },
];

export function resolveJwasuCount(name, store, defaultCount, periodStr) {
  const ov = COUNT_OVERRIDES.find(
    (o) =>
      strip(o.name) === strip(name) &&
      strip(o.store) === strip(store) &&
      (!o.period || String(periodStr || '').startsWith(o.period)),
  );
  return ov ? ov.count : defaultCount;
}

// ── 5. 기간 기반 비노출 ──────────────────────────────────────
//    조혜빈은 6/26 현대무역센터로 완전 이동 → 2026-07부터 신세계본점 쪽 조혜빈은 좌수왕에서 숨김
const HIDE_FROM_PERIOD = [{ name: '조혜빈', store: '신세계본점', fromPeriod: '2026-07' }];

export function isHiddenByPeriod(name, store, periodStr) {
  const p = String(periodStr || '');
  return HIDE_FROM_PERIOD.some(
    (h) => strip(h.name) === strip(name) && strip(h.store) === strip(store) && p >= h.fromPeriod,
  );
}

// ── 6. 순위 제외(표엔 보이되 구분 표시) ──────────────────────
//    현대무역센터 7/23 종료 → 2026-07에만 적용.
//    현황: 달성률 기준 자연 위치에 그대로 노출하되 색상으로만 구분(_muyeok).
//    누적: 그 달의 "월 1등" 계산에서만 제외 → 실제 1등이 달성을 가져간다.
export const UNRANK_STORES = ['현대무역센터', '무역센터 현대'];
export const UNRANK_MONTH = '2026-07';

export const isUnrankStore = (store) => UNRANK_STORES.some((e) => strip(store) === strip(e));

/** 조회 기간이 UNRANK_MONTH를 포함하는가 */
export function isUnrankActive(dates) {
  if (!dates) return false;
  return dates.month === UNRANK_MONTH || String(dates.endDate || '').slice(0, 7) === UNRANK_MONTH;
}

// ── 7. 누적랭킹 전용 제외 ────────────────────────────────────
/** 항상 제외되는 인원 */
export const CUMULATIVE_EXCLUDED_NAMES = ['유승언', '정민서'];

/**
 * 캐스트 하드코딩 패치 — 임건희는 누적개월/미달성을 각 1 더한다.
 * 원본에 사유가 적혀 있지 않다. 근거를 확인하기 전에는 걷어내지 말 것.
 */
export const CAST_MANUAL_PATCH = [{ nameIncludes: '임건희', totalMonths: 1, failed: 1 }];

/** 누적랭킹 좌수왕은 목표 150 이상만 달성 판정 대상 */
export const JWASU_MIN_TARGET = 150;

// ── 공통 유틸 ────────────────────────────────────────────────

/** 조회 기간을 'YYYY-MM'으로 정규화 (월 조회 → month, 기간 조회 → 종료월) */
export const periodOf = (dates) => dates?.month || String(dates?.endDate || '').slice(0, 7) || '';

/** "홍길동 매니저" → "매니저" */
export function extractRole(full) {
  const p = String(full || '').trim().split(/\s+/);
  return p.length >= 2 ? p[p.length - 1] : '';
}

/** "홍길동 매니저" → "홍길동" */
export const extractShortName = (full) => String(full || '').trim().split(/\s+/)[0] || full;

export const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 달성률 → 색상 등급 */
export const rateClass = (r) => (r >= 100 ? 'excellent' : r >= 80 ? 'good' : r >= 50 ? 'warning' : 'danger');

/**
 * 메달 이미지 — Cafe24에 올라가 있는 자산을 그대로 쓴다(로드 실패 시 숫자로 폴백).
 * 캐스트 2·3위는 원본에서 의도적으로 이미지가 뒤바뀌어 있어 그대로 유지한다.
 */
export function badgeImage(cat, rank) {
  const map = { jwasu: 'seat', cast: 'ca', store: 'store' };
  if (!map[cat] || rank < 1 || rank > 3) return null;
  if (cat === 'cast') {
    if (rank === 2) return 'https://yogibo.kr/web/img/off/ca_03.png';
    if (rank === 3) return 'https://yogibo.kr/web/img/off/ca_02.png';
  }
  return `https://yogibo.kr/web/img/off/${map[cat]}_0${rank}.png`;
}

/** 누적랭킹 매장 로고 */
export function storeLogo(storeName) {
  const n = String(storeName || '').toUpperCase();
  if (!n) return null;
  const file =
    n.includes('스타필드') ? '스타필드.png'
    : n.includes('신세계') ? '신세계.png'
    : n.includes('더현대') ? '더현대.png'
    : n.includes('현대') ? '현대.png'
    : n.includes('롯데몰') ? '롯데몰 CI.png'
    : n.includes('롯데') ? '롯데.png'
    : n.includes('아브뉴프랑') ? '아브뉴프랑 로고.png'
    : n.includes('NC') || n.includes('엔씨') ? 'NC.png'
    : null;
  return file ? `https://yogibo.kr/web/img/logo/${encodeURIComponent(file)}` : null;
}
