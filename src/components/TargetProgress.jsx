'use client';

import { useMemo } from 'react';
import { onGet, rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';

/**
 * 이번 달 목표 달성률 — 오프라인 · 자사몰 · 스마트스토어.
 *
 * 달성률만 보면 월초엔 항상 낮아 보인다. 그래서 경과일 기준 "있어야 할 수준"을
 * 같이 계산해 페이스(앞섬/뒤처짐)를 함께 보여준다.
 *   오프라인 목표 = jwasu/dashboard 의 매장별 targetMonthlySales 합 (매장 중복 제거)
 *   온라인 목표   = onlineData /api/target (채널별 target·actual, 경과일 포함)
 */
const fmt = (n) => Math.round(n || 0).toLocaleString();
const eok = (n) => {
  const v = Math.round((n || 0) / 10000);
  return v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${fmt(v)}만`;
};
const monthKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

export default function TargetProgress() {
  const month = monthKST();

  const data = useAsync(async () => {
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const [dash, orders, target] = await Promise.all([
      rtGet('api/jwasu/dashboard', {
        searchType: 'month', month, date: `${month}-${lastDay}`,
        startDate: `${month}-01`, endDate: `${month}-${lastDay}`,
      }).catch(() => null),
      rtGet('api/orders', { month, store: 'all' }).catch(() => null),
      onGet('api/target', { month }).catch(() => null),
    ]);

    // 오프라인 목표 — 같은 매장이 여러 행으로 오므로 매장당 한 번만 더한다
    const seen = new Set();
    let offTarget = 0;
    for (const r of dash?.data || []) {
      const s = r.storeName;
      if (!s || seen.has(s)) continue;
      seen.add(s);
      offTarget += Number(r.targetMonthlySales) || Number(r.targetAmount) || Number(r.monthlyTarget) || 0;
    }
    const offActual = (orders?.orders || [])
      .filter((o) => !isExcludedProduct(o.productName) && !isExcludedStore(o.store))
      .reduce((a, o) => a + Number(o.amount || 0), 0);

    return {
      elapsed: target?.elapsedDays ?? null,
      total: target?.totalDays ?? lastDay,
      rows: [
        { label: '오프라인', target: offTarget, actual: offActual },
        { label: '자사몰', target: target?.cafe24?.target || 0, actual: target?.cafe24?.actual || 0 },
        { label: '스마트스토어', target: target?.smartstore?.target || 0, actual: target?.smartstore?.actual || 0 },
      ],
    };
  }, []);

  const view = useMemo(() => {
    if (!data.data) return null;
    const { rows, elapsed, total } = data.data;
    // 기간이 이만큼 지났으면 이 정도는 나와 있어야 한다는 기준선
    const expected = elapsed && total ? (elapsed / total) * 100 : null;
    return {
      expected,
      elapsed,
      total,
      rows: rows.map((r) => {
        const rate = r.target > 0 ? (r.actual / r.target) * 100 : null;
        const gap = rate != null && expected != null ? rate - expected : null;
        return { ...r, rate, gap };
      }),
    };
  }, [data.data]);

  if (data.loading) return <div className="target-strip target-loading">이번 달 목표 불러오는 중…</div>;
  if (data.error || !view) return null;

  return (
    <section className="target-strip">
      <div className="target-head">
        <strong>{month.slice(5)}월 목표 달성률</strong>
        {view.elapsed != null && (
          <span>
            {view.elapsed}/{view.total}일 경과 · 기준 {view.expected.toFixed(0)}%
          </span>
        )}
      </div>

      <div className="target-rows">
        {view.rows.map((r) => (
          <div className="target-row" key={r.label}>
            <div className="target-label">{r.label}</div>
            <div className="target-bar">
              {view.expected != null && <i className="target-mark" style={{ left: `${Math.min(view.expected, 100)}%` }} />}
              <i className="target-fill" style={{ width: `${Math.min(r.rate || 0, 100)}%` }} />
            </div>
            <div className="target-num">
              <b>{r.rate != null ? `${r.rate.toFixed(1)}%` : '—'}</b>
              {r.gap != null && (
                <span className={`target-gap ${r.gap >= 0 ? 'up' : 'down'}`}>
                  {r.gap >= 0 ? '▲' : '▼'} {Math.abs(r.gap).toFixed(0)}p
                </span>
              )}
            </div>
            <div className="target-amt">
              {eok(r.actual)} / {eok(r.target)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
