import { CATEGORY_ORDER } from './config';

/** 'YYYY-MM' → 그 달 말일 'YYYY-MM-DD' */
export function monthLastDay(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

/**
 * 충전재 분류. 우선순위: 프리미엄플러스 → EPP → 스탠다드 → 프리미엄
 * variant.mergeEpp면 EPP를 '프리미엄'으로 합산한다(매장별 판매분석).
 */
export function classifyFill(name, beadRaw, variant) {
  const n = `${name} ${beadRaw}`.toLowerCase();
  if (n.includes('premium plus') || n.includes('프리미엄 플러스') || n.includes('프리미엄플러스') || beadRaw === 'Premium Plus')
    return '프리미엄플러스';
  if (n.includes('epp') || beadRaw === 'EPP' || beadRaw === 'Premium EPP')
    return variant.mergeEpp ? '프리미엄' : '프리미엄EPP';
  if (n.includes('standard') || n.includes('스탠다드') || beadRaw === 'Standard') return '스탠다드';
  if (n.includes('premium') || n.includes('프리미엄') || beadRaw === 'Premium') return '프리미엄';
  return '기타';
}

export function normalizeOrderLine(o, variant) {
  const productName = String(o.productName || '');
  const beadRaw = String(o.beadType || '');
  return {
    orderNo: String(o.orderNo || ''),
    month: String(o.month || ''),
    date: String(o.date || ''),
    store: String(o.store || '미지정'),
    manager: String(o.manager || ''),
    productName,
    category: String(o.category || '').trim() || '기타',
    color: String(o.color || ''),
    beadType: beadRaw,
    fill: classifyFill(productName, beadRaw, variant),
    qty: Number(o.qty || 1),
    amount: Number(o.amount || 0),
    orderHasSet: !!o.orderHasSet,
    orderHasCover: !!o.orderHasCover,
  };
}

/** 라인 → 주문 단위 집계 (세트/커버 여부는 OR) */
export function buildRawOrders(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.orderNo) continue;
    if (!map.has(r.orderNo))
      map.set(r.orderNo, { orderNo: r.orderNo, month: r.month, store: r.store, amount: 0, hasSet: false, hasCover: false });
    const m = map.get(r.orderNo);
    m.amount += r.amount;
    if (r.orderHasSet) m.hasSet = true;
    if (r.orderHasCover) m.hasCover = true;
  }
  return [...map.values()];
}

const uniqSort = (arr) => [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b), 'ko'));

/** 필터 후보 목록 — 매장은 해당 기간에 매출이 발생한 곳만 노출 */
export function buildMeta(rows, monthsInPeriod, variant) {
  const months = monthsInPeriod?.length ? [...monthsInPeriod] : uniqSort(rows.map((r) => r.month).filter(Boolean));

  const storeAmount = {};
  for (const r of rows) storeAmount[r.store] = (storeAmount[r.store] || 0) + r.amount;

  const categories = CATEGORY_ORDER.filter((c) => rows.some((r) => r.category === c));
  for (const c of uniqSort(rows.map((r) => r.category))) if (!categories.includes(c)) categories.push(c);

  return {
    months,
    stores: uniqSort(Object.keys(storeAmount).filter((s) => s && storeAmount[s] > 0)),
    categories,
    fills: variant.fillKeys.filter((k) => rows.some((r) => r.fill === k)),
    products: uniqSort(rows.map((r) => r.productName).filter(Boolean)),
  };
}
