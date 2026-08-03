import { getManagerLoose } from './managers';
import {
  CAST_MANUAL_PATCH,
  CAST_ROLES,
  CUMULATIVE_EXCLUDED_NAMES,
  JWASU_MIN_TARGET,
  JWASU_ROLES,
  LEAGUE_YEAR,
  SALES_PROXY_STORE,
  UNRANK_MONTH,
  extractRole,
  extractShortName,
  isUnrankStore,
  safeNum,
} from './rules';

const ROLE_PRIORITY = { 매니저: 1, 부매니저: 2, 시니어: 3, 중간관리: 4, 일급제: 5 };
const roleRank = (r) => ROLE_PRIORITY[r] || 99;

/** 무역센터가 "월 1등 계산"에서만 빠지는 달 (원본 EXCLUDE_MONTH) */
const UNRANK_MONTH_NO = Number(UNRANK_MONTH.slice(5, 7));

/**
 * 입사일이 해당 월 1일 이전인가 — 중도 입사자는 그 달 달성 대상에서 뺀다.
 * 입사일이 없거나 파싱 실패면 온전한 달로 본다(원본 동작).
 */
export function isFullMonth(joinDateStr, targetYear, targetMonth) {
  if (!joinDateStr) return true;
  const jd = new Date(joinDateStr);
  if (Number.isNaN(jd.getTime())) return true;

  const y = jd.getFullYear();
  const m = jd.getMonth() + 1;
  const d = jd.getDate();
  if (y > targetYear || (y === targetYear && m > targetMonth)) return false;
  if (y === targetYear && m === targetMonth && d > 1) return false;
  return true;
}

const stat = (name, storeName, role = '') => ({ name, storeName, role, totalMonths: 0, achieved: 0, failed: 0 });

/**
 * 정렬 + 동순위 부여.
 * 기준: 달성횟수 > 누적개월 > 미달성횟수 > 매장명 > 직급 > 이름
 * 앞 세 값이 모두 같으면 같은 순위를 공유한다.
 */
export function applyRanking(arr) {
  const sortFn = (a, b) => {
    if (b.achieved !== a.achieved) return b.achieved - a.achieved;
    if (b.totalMonths !== a.totalMonths) return b.totalMonths - a.totalMonths;
    if (a.failed !== b.failed) return a.failed - b.failed;
    if (a.storeName !== b.storeName) return a.storeName < b.storeName ? -1 : 1;
    const ra = roleRank(a.role);
    const rb = roleRank(b.role);
    if (ra !== rb) return ra - rb;
    if (a.name && b.name && a.name !== b.name) return a.name < b.name ? -1 : 1;
    return 0;
  };

  const sorted = [...arr].sort(sortFn);
  let rank = 1;
  let prev = [-1, -1, -1];
  sorted.forEach((it, i) => {
    if (it.achieved !== prev[0] || it.totalMonths !== prev[1] || it.failed !== prev[2]) {
      rank = i + 1;
      prev = [it.achieved, it.totalMonths, it.failed];
    }
    it.rank = rank;
  });
  return sorted;
}

/**
 * 누적 집계 — 1월부터 targetMonth까지 매달 "월 1등"을 뽑아 달성/미달성을 쌓는다.
 *
 * @param {Array<{month:number, dashboard:any, orders:any}>} monthly
 * @param {number} targetMonth  조회 기준월 (이 달에 활동한 인원만 표에 남는다)
 * @param {object} mgrMap
 */
export function buildCumulative(monthly, targetMonth, mgrMap) {
  const jwasuMap = {};
  const castMap = {};
  const storeMap = {};

  const activeJwasu = new Set();
  const activeCast = new Set();
  const activeStore = new Set();

  const isHardExcluded = (store, name) => store === SALES_PROXY_STORE || CUMULATIVE_EXCLUDED_NAMES.includes(name);
  const isRankOnlyExcl = (m, store) => m === UNRANK_MONTH_NO && isUnrankStore(store);

  for (const { month: m, dashboard, orders } of monthly) {
    const isTarget = m === targetMonth;

    // 입사일 사전
    const joinDate = {};
    for (const row of dashboard?.data || []) {
      const n = String(row.managerName || '').trim();
      if (n) joinDate[`${row.storeName}_${n}`] = row.joinDate;
    }

    // ── 캐스트 후보: 직영 개인별 매출
    const staffSales = {};
    for (const o of orders?.orders || []) {
      const name = extractShortName(o.manager || '');
      const store = o.store || '미지정';
      if (store === '미지정') continue;

      const info = getManagerLoose(mgrMap, name, store);
      if (info && info.consignment === 'Y') continue;
      const role = info ? info.role : extractRole(o.manager || '');
      if (!CAST_ROLES.includes(role)) continue;

      const key = `${store}_${name}`;
      if (!staffSales[key]) staffSales[key] = { store, name, role, sales: 0 };
      staffSales[key].sales += safeNum(o.amount);
    }

    const castCand = Object.values(staffSales).map((s) => {
      const key = `${s.store}_${s.name}`;
      if (isTarget) activeCast.add(key);
      // 중도 입사자는 -1 → 1등 판정에서 자연히 탈락
      return { key, store: s.store, name: s.name, role: s.role, sales: isFullMonth(joinDate[key], LEAGUE_YEAR, m) ? s.sales : -1 };
    });

    // ── 매장 월 매출 (필터 없이 전체 합)
    const storeSales = {};
    for (const o of orders?.orders || []) {
      const st = o.store || '미지정';
      storeSales[st] = (storeSales[st] || 0) + safeNum(o.amount);
    }

    // ── 좌수왕 · 스토어 후보
    const jwasuCand = [];
    const storeCand = [];
    const seenStores = new Set();

    for (const row of dashboard?.data || []) {
      const store = row.storeName;
      if (!store) continue;

      const name = String(row.managerName || '').trim();
      if (name && name !== 'system_store_placeholder') {
        const info = getManagerLoose(mgrMap, name, store);
        const role = row.role && row.role !== '-' ? row.role : info ? info.role : '';
        if (JWASU_ROLES.includes(role)) {
          const target = safeNum(row.targetCount);
          const actual = safeNum(row.count);
          if (target > 0 || actual > 0) {
            const key = `${store}_${name}`;
            const ok = isFullMonth(row.joinDate, LEAGUE_YEAR, m) && target >= JWASU_MIN_TARGET;
            jwasuCand.push({ key, store, name, role, rate: ok ? (actual / target) * 100 : -1 });
            if (isTarget) activeJwasu.add(key);
          }
        }
      }

      const monthlyT = safeNum(row.targetMonthlySales) || safeNum(row.targetAmount) || safeNum(row.monthlyTarget);
      const tw = row.targetWeeklySales || {};
      const weeklyT = safeNum(tw.w1) + safeNum(tw.w2) + safeNum(tw.w3) + safeNum(tw.w4) + safeNum(tw.w5);
      const target = monthlyT > 0 ? monthlyT : weeklyT;
      const sales = storeSales[store] || 0;

      if (target > 0 && sales > 0 && !seenStores.has(store)) {
        seenStores.add(store);
        storeCand.push({ store, rate: (sales / target) * 100 });
        if (isTarget) activeStore.add(store);
      }
    }

    // ── 월 1등 판정 (순위제외 대상은 최댓값 계산에서 뺀다)
    const eCast = castCand.filter((c) => !isHardExcluded(c.store, c.name));
    const eJwasu = jwasuCand.filter((c) => !isHardExcluded(c.store, c.name));
    const eStore = storeCand.filter((c) => !isHardExcluded(c.store, ''));

    const maxCast = Math.max(-1, ...eCast.filter((c) => !isRankOnlyExcl(m, c.store)).map((c) => c.sales));
    const maxJwasu = Math.max(-1, ...eJwasu.filter((c) => !isRankOnlyExcl(m, c.store)).map((c) => c.rate));
    const maxStore = Math.max(-1, ...eStore.filter((c) => !isRankOnlyExcl(m, c.store)).map((c) => c.rate));

    const tally = (map, key, obj, isWinner) => {
      if (!map[key]) map[key] = obj;
      map[key].totalMonths++;
      if (isWinner) map[key].achieved++;
      else map[key].failed++;
    };

    for (const c of eCast)
      tally(castMap, c.key, stat(c.name, c.store, c.role), c.sales === maxCast && maxCast > 0 && !isRankOnlyExcl(m, c.store));
    for (const c of eJwasu)
      tally(jwasuMap, c.key, stat(c.name, c.store, c.role), c.rate === maxJwasu && maxJwasu >= 0 && !isRankOnlyExcl(m, c.store));
    for (const c of eStore)
      tally(storeMap, c.store, stat(c.store, c.store), c.rate === maxStore && maxStore >= 0 && !isRankOnlyExcl(m, c.store));
  }

  // 캐스트 수기 패치 (원본에 사유 미기재 — 근거 확인 전 제거 금지)
  for (const patch of CAST_MANUAL_PATCH) {
    for (const key in castMap) {
      if (key.includes(patch.nameIncludes)) {
        castMap[key].totalMonths += patch.totalMonths;
        castMap[key].failed += patch.failed;
      }
    }
  }

  const keep = (item, activeSet, useName = true) =>
    activeSet.has(useName ? `${item.storeName}_${item.name}` : item.storeName) &&
    item.storeName !== SALES_PROXY_STORE &&
    !CUMULATIVE_EXCLUDED_NAMES.includes(item.name);

  return {
    jwasu: applyRanking(Object.values(jwasuMap).filter((i) => keep(i, activeJwasu))),
    cast: applyRanking(Object.values(castMap).filter((i) => keep(i, activeCast))),
    store: applyRanking(Object.values(storeMap).filter((i) => keep(i, activeStore, false))),
  };
}
