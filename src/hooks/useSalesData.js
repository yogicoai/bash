'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rtGet } from '@/lib/api';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildMeta, buildRawOrders, monthLastDay, normalizeOrderLine } from '@/lib/sales/normalize';

/** 최근 12개월 (months API 실패 시 폴백) */
function fallbackMonths() {
  const now = new Date();
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * 기간 단위 lazy 로드.
 *   /api/months            사용 가능 월
 *   /api/orders            월별 판매 라인 (월 단위로 병렬 호출)
 *   /api/jwasu/table       월별 방문수 (기간 경계는 선택 기간으로 클램프)
 */
export function useSalesData(variant) {
  const [availableMonths, setAvailableMonths] = useState([]);
  const [period, setPeriod] = useState({ start: null, end: null });
  const [preset, setPresetState] = useState(1);
  const [state, setState] = useState({ rows: [], orders: [], monthlyVisits: {}, storeVisits: {}, months: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partial, setPartial] = useState(0);
  const reqId = useRef(0);

  const load = useCallback(
    async (startDate, endDate, months) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const [orderResults, visitResults] = await Promise.all([
          Promise.all(months.map((m) => rtGet('api/orders', { month: m, store: 'all' }).catch(() => null))),
          Promise.all(
            months.map((m) => {
              // 각 월의 조회 범위를 선택 기간으로 클램프
              const dStart = `${m}-01` < startDate ? startDate : `${m}-01`;
              const dEnd = monthLastDay(m) > endDate ? endDate : monthLastDay(m);
              return rtGet('api/jwasu/table', { startDate: dStart, endDate: dEnd }).catch(() => null);
            }),
          ),
        ]);
        if (id !== reqId.current) return; // 더 최신 요청이 있으면 버림

        let failed = 0;
        const all = [];
        orderResults.forEach((res, idx) => {
          if (!res) { failed++; return; }
          const arr = Array.isArray(res?.orders) ? res.orders : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          for (const o of arr) {
            if (isExcludedProduct(o.productName)) continue;
            if (isExcludedStore(o.store)) continue;
            const d = String(o.date || '').slice(0, 10);
            if (d && (d < startDate || d > endDate)) continue;
            all.push({ ...o, month: o.month || months[idx] });
          }
        });

        const monthlyVisits = {};
        const storeVisits = {};
        visitResults.forEach((res, idx) => {
          let total = 0;
          if (Array.isArray(res?.report)) {
            for (const r of res.report) {
              const c = Number(r.count) || 0;
              total += c;
              const st = String(r.store || r.storeName || '').trim();
              if (st && !isExcludedStore(st)) storeVisits[st] = (storeVisits[st] || 0) + c;
            }
          }
          monthlyVisits[months[idx]] = total;
        });

        const rows = all.map((o) => normalizeOrderLine(o, variant));
        setPartial(failed);
        setState({ rows, orders: buildRawOrders(rows), monthlyVisits, storeVisits, months });
      } catch (e) {
        if (id === reqId.current) setError(e);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [variant],
  );

  // 최초: 사용 가능 월 조회 → 기본 기간(이번 달)
  useEffect(() => {
    let alive = true;
    (async () => {
      let list;
      try {
        const res = await rtGet('api/months');
        list = Array.isArray(res?.months) && res.months.length ? [...res.months].sort() : fallbackMonths();
      } catch {
        list = fallbackMonths();
      }
      if (!alive) return;
      setAvailableMonths(list);
      const end = list[list.length - 1];
      const startDate = `${end}-01`;
      const endDate = monthLastDay(end);
      setPeriod({ start: startDate, end: endDate });
      load(startDate, endDate, [end]);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const monthsIn = useCallback(
    (startDate, endDate) => availableMonths.filter((m) => m >= startDate.slice(0, 7) && m <= endDate.slice(0, 7)),
    [availableMonths],
  );

  const applyPreset = useCallback(
    (p) => {
      if (!availableMonths.length) return;
      const endMonth = availableMonths[availableMonths.length - 1];
      const startMonth =
        p === 'all' ? availableMonths[0] : availableMonths[Math.max(0, availableMonths.length - Number(p))];
      const startDate = `${startMonth}-01`;
      const endDate = monthLastDay(endMonth);
      setPresetState(p);
      setPeriod({ start: startDate, end: endDate });
      load(startDate, endDate, monthsIn(startDate, endDate));
    },
    [availableMonths, load, monthsIn],
  );

  const applyCustom = useCallback(
    (startDate, endDate) => {
      if (!startDate || !endDate || startDate > endDate) return;
      setPresetState(null);
      setPeriod({ start: startDate, end: endDate });
      load(startDate, endDate, monthsIn(startDate, endDate));
    },
    [load, monthsIn],
  );

  const reload = useCallback(() => {
    if (period.start && period.end) load(period.start, period.end, monthsIn(period.start, period.end));
  }, [load, monthsIn, period]);

  const meta = useMemo(() => buildMeta(state.rows, state.months, variant), [state.rows, state.months, variant]);

  const bounds = useMemo(
    () =>
      availableMonths.length
        ? { min: `${availableMonths[0]}-01`, max: monthLastDay(availableMonths[availableMonths.length - 1]) }
        : { min: undefined, max: undefined },
    [availableMonths],
  );

  return { availableMonths, bounds, period, preset, applyPreset, applyCustom, reload, meta, loading, error, partial, ...state };
}
