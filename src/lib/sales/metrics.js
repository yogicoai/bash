/** 판매 라인 + 주문 목록 → 핵심 지표 */
export function computeKpiMetrics(rows, orders) {
  const totalQty = rows.reduce((a, r) => a + r.qty, 0);
  const totalAmount = rows.reduce((a, r) => a + r.amount, 0);
  const sofaQty = rows.filter((r) => r.category === '소파').reduce((a, r) => a + r.qty, 0);
  const bpQty = rows.filter((r) => r.category === '바디필로우').reduce((a, r) => a + r.qty, 0);
  const oc = orders.length;
  const setCount = orders.filter((o) => o.hasSet).length;
  const coverCount = orders.filter((o) => o.hasCover).length;

  return {
    totalQty,
    totalAmount,
    sofaQty,
    bpQty,
    oc,
    setCount,
    coverCount,
    sofaRate: totalQty > 0 ? (sofaQty / totalQty) * 100 : 0,
    bpRate: totalQty > 0 ? (bpQty / totalQty) * 100 : 0,
    setRate: oc > 0 ? (setCount / oc) * 100 : 0,
    coverRate: oc > 0 ? (coverCount / oc) * 100 : 0,
    aov: oc > 0 ? Math.round(totalAmount / oc) : 0,
  };
}

/** 월별 KPI 시계열 — 미니 카드와 통합 추이 차트 공용 */
export function computeKpiSeries(months, rawOrders, selectedStores, monthlyVisits) {
  return months.map((m) => {
    const orders = rawOrders.filter((o) => o.month === m && selectedStores.has(o.store));
    const oc = orders.length;
    const amt = orders.reduce((a, o) => a + o.amount, 0);
    const visits = monthlyVisits[m] || 0;
    return {
      m,
      setR: oc > 0 ? (orders.filter((o) => o.hasSet).length / oc) * 100 : 0,
      coverR: oc > 0 ? (orders.filter((o) => o.hasCover).length / oc) * 100 : 0,
      aov: oc > 0 ? Math.round(amt / oc) : 0,
      cvr: visits > 0 ? (oc / visits) * 100 : 0,
    };
  });
}

/** 매장별 비교 지표 */
export function computeStoreStats(rows, rawOrders, storeVisits) {
  const byStore = new Map();
  for (const r of rows) {
    if (!byStore.has(r.store)) byStore.set(r.store, []);
    byStore.get(r.store).push(r);
  }
  return [...byStore.entries()].map(([store, sr]) => {
    const orders = rawOrders.filter((o) => o.store === store);
    const m = computeKpiMetrics(sr, orders);
    const visits = storeVisits[store] || 0;
    return { store, ...m, visits, cvr: visits > 0 ? (m.oc / visits) * 100 : 0 };
  });
}

export const formatAmount = (n) => Math.round(n || 0).toLocaleString() + '원';
