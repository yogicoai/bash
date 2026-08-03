import { getManagerStrict, isStoreActive } from './managers';
import {
  CAST_ROLES,
  JWASU_ROLES,
  extractRole,
  extractShortName,
  isAllowedInStore,
  isHiddenByPeriod,
  isUnrankActive,
  isUnrankStore,
  periodOf,
  resolveJwasuCount,
  resolveProxyStore,
  resolveSplitStore,
  safeNum,
} from './rules';

/**
 * 순위 부여. 무역센터(7월)는 달성률 기준 자연 위치에 그대로 두고
 * 색상 구분 플래그(_muyeok)만 세운다 — 맨 아래로 내리지 않는다.
 */
function finalizeRanks(arr, dates) {
  const unrankOn = isUnrankActive(dates);
  arr.forEach((it, i) => {
    it.rank = i + 1;
    it._muyeok = unrankOn && isUnrankStore(it.storeName);
  });
  return arr;
}

/**
 * 좌수왕 — /api/jwasu/dashboard 기준. 서버가 계산한 count/targetCount를 쓰되
 * 보정 규칙(화이트리스트·기간 비노출·수기 좌수)을 적용한다.
 */
export function buildJwasu({ dashboard, mgrMap, dates, filterType = 'all', excludedPeople = [], excludedStores = [] }) {
  const period = periodOf(dates);
  const rankings = [];

  for (const row of dashboard?.data || []) {
    const name = String(row.managerName || '').trim();
    const store = row.storeName || '';
    if (!name || name === 'system_store_placeholder') continue;

    if (excludedPeople.includes(`${store}|${name}`)) continue;
    if (excludedStores.includes(store)) continue;
    if (!isAllowedInStore(name, store)) continue;
    if (isHiddenByPeriod(name, store, period)) continue;

    const info = getManagerStrict(mgrMap, name, store);
    if (info && info.isActive === false) continue;

    // 직급은 통합관리(admin) 정보를 대시보드 row.role보다 우선한다
    const role = info ? info.role : row.role && row.role !== '-' ? row.role : '';
    const consignment = info ? info.consignment : 'N';
    if (filterType === 'direct' && consignment === 'Y') continue;
    if (filterType === 'consign' && consignment !== 'Y') continue;
    if (!JWASU_ROLES.includes(role)) continue;

    const target = safeNum(row.targetCount);
    const actual = resolveJwasuCount(name, store, safeNum(row.count), period);
    rankings.push({
      name,
      storeName: store,
      role,
      consignment,
      target,
      actual,
      rate: target > 0 ? (actual / target) * 100 : 0,
    });
  }

  rankings.sort((a, b) => (b.rate !== a.rate ? b.rate - a.rate : b.actual - a.actual));
  return finalizeRanks(rankings, dates);
}

/**
 * 캐스트 — 직영(위탁 제외) 개인별 매출.
 * 이름+매장 조합으로 집계해서 근무지 이동 시 매장별로 따로 잡힌다.
 */
export function buildCast({ orders, mgrMap, dates, excludedStores = [] }) {
  const salesMap = {};

  for (const o of orders?.orders || []) {
    const full = o.manager || '';
    const shortName = extractShortName(full);
    const orderRole = extractRole(full);
    const proxied = resolveProxyStore(shortName, o.store || '', mgrMap);
    const info = getManagerStrict(mgrMap, shortName, proxied);

    const baseStore = info ? info.storeName : proxied;
    const finalStore = resolveSplitStore(shortName, o.date, baseStore);

    if (excludedStores.includes(finalStore)) continue;
    if (!isAllowedInStore(shortName, finalStore)) continue;
    if (info && info.isActive === false) continue;
    if (info && info.consignment === 'Y') continue;

    const role = info ? info.role : orderRole;
    if (!CAST_ROLES.includes(role)) continue;

    const key = `${shortName}|${finalStore}`;
    if (!salesMap[key]) salesMap[key] = { name: shortName, storeName: finalStore, role, sales: 0 };
    salesMap[key].sales += safeNum(o.amount);
  }

  const rankings = Object.values(salesMap).sort((a, b) => b.sales - a.sales);
  return finalizeRanks(rankings, dates);
}

/** 스토어 — 매장 목표매출 대비 달성률. 활성 매니저가 있는 매장만, 매출 0원은 제외. */
export function buildStore({ orders, dashboard, mgrMap, dates, excludedStores = [] }) {
  const targetMap = {};
  for (const row of dashboard?.data || []) {
    const sn = row.storeName;
    if (!sn || excludedStores.includes(sn)) continue;
    if (!isStoreActive(mgrMap, sn)) continue;
    if (targetMap[sn] != null) continue;

    const monthly = safeNum(row.targetMonthlySales) || safeNum(row.targetAmount) || safeNum(row.monthlyTarget);
    const tw = row.targetWeeklySales || {};
    const weekly = safeNum(tw.w1) + safeNum(tw.w2) + safeNum(tw.w3) + safeNum(tw.w4) + safeNum(tw.w5);
    const target = monthly > 0 ? monthly : weekly;
    if (target === 0) continue;
    targetMap[sn] = target;
  }

  const salesMap = {};
  for (const o of orders?.orders || []) {
    const s = o.store || '미지정';
    if (excludedStores.includes(s)) continue;
    if (!isStoreActive(mgrMap, s)) continue;
    salesMap[s] = (salesMap[s] || 0) + safeNum(o.amount);
  }

  const rankings = [];
  for (const sn of new Set([...Object.keys(targetMap), ...Object.keys(salesMap)])) {
    if (sn === '미지정') continue;
    const target = targetMap[sn] || 0;
    const sales = salesMap[sn] || 0;
    if (sales === 0) continue; // 매출 0원 매장 완전 제외
    rankings.push({ name: sn, storeName: sn, target, sales, rate: target > 0 ? (sales / target) * 100 : 0 });
  }

  rankings.sort((a, b) => (b.rate !== a.rate ? b.rate - a.rate : b.sales - a.sales));
  return finalizeRanks(rankings, dates);
}
