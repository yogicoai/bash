/**
 * 물류센터 재고 (원본 deliveryOFF/재고관리.html) 규칙.
 *   원천: realtime /api/stock/:category  → [{ category, code, name, spec, qty }]
 */

/** 커버 탭의 "요기보" 그룹 판정에 쓰는 본품 키워드 */
export const YOGIBO_MAIN_LIST = [
  '맥스', '롤 맥스', '미니', '라운저', '미디', '피라미드',
  '서포트', '드롭', '팟', '더블', '롤 미니', '롤 미디',
  '버블', '오토만', '허기보', '카터필러', '슬림', '프라임',
];

export const TABS = [
  { key: '전체', label: '전체' },
  { key: '커버', label: '커버' },
  { key: '이너', label: '이너' },
  { key: '인형', label: '인형' },
  { key: '리빙', label: '리빙' },
  { key: '안전재고', label: '⚠️ 안전재고', tone: 'warn' },
  { key: '재고소진', label: '🚫 재고소진', tone: 'bad' },
];

/** 안전재고/재고소진 탭도 데이터는 '전체'를 받아서 수량으로 거른다 */
export const fetchCategoryOf = (tab) => (tab === '안전재고' || tab === '재고소진' ? '전체' : tab);

/** 화면에서 숨기는 품목 — '제외' 카테고리와 이름에 EPP가 든 것 */
export function cleanRows(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((i) => i.category !== '제외' && !String(i.name || '').toUpperCase().includes('EPP'))
    // 원본 표기 보정
    .map((i) => (String(i.name || '').includes('사스') ? { ...i, name: i.name.replace('사스', '사이너스') } : i));
}

export function applyTabFilter(rows, tab) {
  if (tab === '안전재고') return rows.filter((i) => i.qty >= 4 && i.qty <= 10);
  if (tab === '재고소진') return rows.filter((i) => i.qty <= 3);
  return rows;
}

/** 서브 필터 후보 — 커버·인형은 고정 그룹, 나머지는 상품명(건수 많은 순) */
export function subGroupsOf(tab, rows) {
  if (tab === '커버') return ['요기보', '줄라', '럭스', '기타'];
  if (tab === '인형') return ['메이트', '스퀴지보', '기타'];
  if (['전체', '안전재고', '재고소진'].includes(tab)) return [];
  return countedNames(rows);
}

export function countedNames(rows) {
  const map = new Map();
  for (const i of rows) map.set(i.name, (map.get(i.name) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

export function applySubFilter(rows, tab, key) {
  if (!key) return rows;

  if (tab === '커버') {
    const isSpecial = (n) => n.includes('줄라') || n.includes('럭스');
    if (key === '줄라') return rows.filter((i) => i.name.includes('줄라'));
    if (key === '럭스') return rows.filter((i) => i.name.includes('럭스'));
    if (key === '요기보') return rows.filter((i) => !isSpecial(i.name) && YOGIBO_MAIN_LIST.some((k) => i.name.includes(k)));
    return rows.filter((i) => !isSpecial(i.name) && !YOGIBO_MAIN_LIST.some((k) => i.name.includes(k)));
  }

  if (tab === '인형') {
    if (key === '스퀴지보') return rows.filter((i) => i.name.includes('스퀴지보'));
    if (key === '메이트') return rows.filter((i) => !i.name.includes('스퀴지보') && i.name.includes('메이트'));
    return rows.filter((i) => !i.name.includes('메이트') && !i.name.includes('스퀴지보'));
  }

  return rows.filter((i) => i.name === key);
}

/** 품절(수량 0 이하)은 정렬 기준과 무관하게 항상 맨 아래 */
export function sortRows(rows, column, asc) {
  return [...rows].sort((a, b) => {
    const outA = a.qty <= 0;
    const outB = b.qty <= 0;
    if (outA !== outB) return outA ? 1 : -1;

    if (column === 'qty') return asc ? a.qty - b.qty : b.qty - a.qty;
    const x = String(a[column] ?? '').toLowerCase();
    const y = String(b[column] ?? '').toLowerCase();
    return asc ? x.localeCompare(y, 'ko') : y.localeCompare(x, 'ko');
  });
}

export function searchRows(rows, query) {
  const keywords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!keywords.length) return rows;
  return rows.filter((i) => {
    const t = `${i.code} ${i.name} ${i.spec} ${i.category}`.toLowerCase();
    return keywords.every((k) => t.includes(k));
  });
}

/** 수량 상태 — 원본의 색상 규칙 그대로 */
export function stockState(qty) {
  if (qty <= 0) return 'out';
  if (qty <= 3) return 'critical';
  if (qty <= 10) return 'safety';
  return 'ok';
}

export const CATEGORY_TONE = {
  커버: 'cover',
  이너: 'inner',
  인형: 'doll',
  리빙: 'living',
};
