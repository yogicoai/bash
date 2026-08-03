'use client';

import { useEffect, useMemo, useState } from 'react';
import DataState from '@/components/DataState';
import { rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildRawOrders } from '@/lib/sales/normalize';

/**
 * 실시간 매장별 매출 — 오늘 하루.
 *
 * 갱신 정책: 원천(이카운트)이 10분 주기라 그보다 자주 부를 이유가 없다.
 *   · 10분마다 자동 갱신
 *   · 단, 탭이 보일 때만 — 열어두고 방치한 창이 계속 호출하지 않게
 *   · 다른 탭에 있다가 돌아오면 즉시 한 번 갱신
 *   · 수동 버튼으로 언제든 갱신
 */
const REFRESH_MS = 10 * 60_000;
const fmt = (n) => Math.round(n || 0).toLocaleString();
const won = (n) => `${fmt(n)}원`;
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export default function TodaySales() {
  const [tick, setTick] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(null);
  const today = todayKST();

  const data = useAsync(async () => {
    const json = await rtGet('api/orders', { month: today.slice(0, 7), store: 'all' });
    const lines = (json?.orders || []).filter(
      (o) =>
        String(o.date || '').slice(0, 10) === today &&
        !isExcludedProduct(o.productName) &&
        !isExcludedStore(o.store),
    );
    setFetchedAt(new Date());
    return lines;
  }, [tick]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') bump();
    }, REFRESH_MS);
    // 탭으로 돌아오면 즉시 최신값으로
    const onVisible = () => document.visibilityState === 'visible' && bump();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const { rows, total } = useMemo(() => {
    const lines = data.data || [];
    const byStore = new Map();
    for (const o of lines) {
      const s = o.store || '미지정';
      if (!byStore.has(s)) byStore.set(s, []);
      byStore.get(s).push(o);
    }
    const rows = [...byStore.entries()]
      .map(([store, ls]) => {
        const amount = ls.reduce((a, o) => a + Number(o.amount || 0), 0);
        const oc = buildRawOrders(ls).length;
        const qty = ls.reduce((a, o) => a + Number(o.qty || 1), 0);
        return { store, amount, oc, qty, aov: oc ? amount / oc : 0 };
      })
      .sort((a, b) => b.amount - a.amount);

    const total = rows.reduce(
      (a, r) => ({ amount: a.amount + r.amount, oc: a.oc + r.oc, qty: a.qty + r.qty }),
      { amount: 0, oc: 0, qty: 0 },
    );
    return { rows, total };
  }, [data.data]);

  const max = Math.max(1, ...rows.map((r) => r.amount));

  return (
    <>
      <div className="toolbar">
        <span className="badge live-badge">● 실시간 · 10분마다 자동 갱신</span>
        <span className="badge">{today}</span>
        {fetchedAt && (
          <span className="badge">
            {fetchedAt.toLocaleTimeString('ko-KR', { hour12: false })} 기준
          </span>
        )}
        <button type="button" className="btn" onClick={() => setTick((t) => t + 1)} disabled={data.loading}>
          {data.loading ? '갱신 중…' : '↻ 지금 갱신'}
        </button>
      </div>

      <section className="hub" style={{ marginBottom: 20 }}>
        <div className="hub-tile">
          <div className="hub-label">오늘 매출</div>
          <div className="hub-value">{won(total.amount)}</div>
          <div className="hub-sub">{rows.length}개 매장</div>
        </div>
        <div className="hub-tile">
          <div className="hub-label">구매 건수</div>
          <div className="hub-value">{fmt(total.oc)}건</div>
          <div className="hub-sub">판매수량 {fmt(total.qty)}개</div>
        </div>
        <div className="hub-tile">
          <div className="hub-label">객단가</div>
          <div className="hub-value">{won(total.oc ? total.amount / total.oc : 0)}</div>
          <div className="hub-sub">매출 ÷ 구매건수</div>
        </div>
      </section>

      <DataState
        loading={data.loading && !data.data}
        error={data.error}
        empty={!data.loading && !data.error && rows.length === 0}
        emptyText="오늘 아직 판매가 없습니다."
        onRetry={() => setTick((t) => t + 1)}
      />

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="col-narrow center">순위</th>
                <th>매장</th>
                <th className="right">매출</th>
                <th className="right">구매건수</th>
                <th className="right">수량</th>
                <th className="right">객단가</th>
                <th style={{ width: 140 }}>비중</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.store}>
                  <td className="center"><span className="rank-badge">{i + 1}</span></td>
                  <td className="strong">{r.store}</td>
                  <td className="right mono strong">{won(r.amount)}</td>
                  <td className="right mono">{fmt(r.oc)}건</td>
                  <td className="right mono dim">{fmt(r.qty)}</td>
                  <td className="right mono">{won(r.aov)}</td>
                  <td><div className="minibar"><div style={{ width: `${(r.amount / max) * 100}%` }} /></div></td>
                </tr>
              ))}
              <tr className="total-row">
                <td />
                <td><strong>합계 · {rows.length}개 매장</strong></td>
                <td className="right mono"><strong>{won(total.amount)}</strong></td>
                <td className="right mono">{fmt(total.oc)}건</td>
                <td className="right mono">{fmt(total.qty)}</td>
                <td className="right mono">{won(total.oc ? total.amount / total.oc : 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
