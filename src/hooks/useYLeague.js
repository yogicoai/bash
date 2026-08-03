'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rtGet } from '@/lib/api';
import { buildManagerMap } from '@/lib/yleague/managers';
import { LEAGUE_YEAR } from '@/lib/yleague/rules';

/** 매니저 마스터는 화면 전체에서 한 번만 받으면 된다 */
let managerCache = null;
async function loadManagers() {
  if (managerCache) return managerCache;
  const json = await rtGet('api/jwasu/admin/managers').catch(() => null);
  managerCache = buildManagerMap(json?.managers || []);
  return managerCache;
}

const lastDayOf = (y, m) => new Date(y, m, 0).getDate();
const pad = (n) => String(n).padStart(2, '0');

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { startDate: `${ym}-01`, endDate: `${ym}-${pad(lastDayOf(y, m))}` };
}

/** 조회 가능한 월 목록 (내림차순) — 현재 월이 빠져 있으면 넣어준다 */
export function useAvailableMonths() {
  const [months, setMonths] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const now = new Date();
      const cur = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
      let list = [];
      try {
        const json = await rtGet('api/months');
        list = Array.isArray(json?.months) ? json.months : [];
      } catch {
        list = [];
      }
      if (!list.includes(cur)) list.push(cur);
      if (alive) setMonths([...new Set(list)].sort().reverse());
    })();
    return () => {
      alive = false;
    };
  }, []);
  return months;
}

/**
 * Y리그 현황 데이터 — 좌수 대시보드 + 주문 + 매니저 마스터.
 * dates: { type:'month'|'range', month?, startDate, endDate }
 */
export function useYLeagueStatus(dates) {
  const [state, setState] = useState({ dashboard: null, orders: null, mgrMap: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  const key = dates ? `${dates.type}|${dates.month || ''}|${dates.startDate}|${dates.endDate}` : '';

  const load = useCallback(async () => {
    if (!dates?.startDate || !dates?.endDate) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const orderParams =
        dates.type === 'range'
          ? { store: 'all', searchType: 'range', startDate: dates.startDate, endDate: dates.endDate }
          : { store: 'all', searchType: 'month', month: dates.month, startDate: dates.startDate, endDate: dates.endDate };

      const [dashboard, orders, mgrMap] = await Promise.all([
        rtGet('api/jwasu/dashboard', {
          searchType: dates.type,
          date: dates.endDate,
          startDate: dates.startDate,
          endDate: dates.endDate,
        }).catch(() => null),
        rtGet('api/orders', orderParams).catch(() => null),
        loadManagers(),
      ]);
      if (id !== reqId.current) return;
      setState({ dashboard, orders, mgrMap });
    } catch (e) {
      if (id === reqId.current) setError(e);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, loading, error, reload: load };
}

/**
 * 월별 원자료 캐시 — 한 번 받은 달은 다시 받지 않는다.
 * 누적 집계 특성상 1월~선택월이 모두 필요하지만, 월을 바꿔도
 * "아직 안 받은 달"만 추가로 가져온다. (8월→5월은 요청 0건)
 */
const monthCache = new Map();

/**
 * Y리그 누적 데이터 — 1월부터 targetMonth까지 월별 대시보드+주문.
 * 누적 달성/미달성은 매달 1등을 뽑아 쌓는 값이라 이전 달들이 반드시 필요하다.
 * 대신 캐시 덕분에 각 달은 최대 한 번만 호출된다.
 */
export function useYLeagueCumulative(targetMonth) {
  const [monthly, setMonthly] = useState([]);
  const [mgrMap, setMgrMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!targetMonth) return;
    const id = ++reqId.current;
    const needed = [];
    for (let m = 1; m <= targetMonth; m++) if (!monthCache.has(m)) needed.push(m);

    setError(null);
    setProgress({ done: 0, total: needed.length });
    setLoading(needed.length > 0);

    try {
      const map = await loadManagers();
      if (id !== reqId.current) return;
      setMgrMap(map);

      let done = 0;
      await Promise.all(
        needed.map(async (m) => {
          const ym = `${LEAGUE_YEAR}-${pad(m)}`;
          const { startDate, endDate } = monthRange(ym);
          const [dashboard, orders] = await Promise.all([
            rtGet('api/jwasu/dashboard', { searchType: 'month', month: ym, date: endDate, startDate, endDate }).catch(() => null),
            rtGet('api/orders', { store: 'all', searchType: 'month', month: ym, startDate, endDate }).catch(() => null),
          ]);
          monthCache.set(m, { month: m, dashboard, orders });
          if (id === reqId.current) setProgress({ done: ++done, total: needed.length });
        }),
      );
      if (id !== reqId.current) return;

      const results = [];
      for (let m = 1; m <= targetMonth; m++) if (monthCache.has(m)) results.push(monthCache.get(m));
      setMonthly(results);
    } catch (e) {
      if (id === reqId.current) setError(e);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [targetMonth]);

  useEffect(() => {
    load();
  }, [load]);

  /** 강제 새로고침 — 캐시를 비우고 다시 받는다 (조회하기 버튼) */
  const refresh = useCallback(() => {
    monthCache.clear();
    load();
  }, [load]);

  return { monthly, mgrMap, loading, error, progress, reload: load, refresh };
}

/** 누적랭킹 월 선택지 — LEAGUE_YEAR 1월부터 (올해면 이번 달까지) */
export function useCumulativeMonths() {
  return useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const max = y === LEAGUE_YEAR ? now.getMonth() + 1 : y > LEAGUE_YEAR ? 12 : 1;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, []);
}
