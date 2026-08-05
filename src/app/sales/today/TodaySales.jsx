'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import DataState from '@/components/DataState';
import { rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildRawOrders } from '@/lib/sales/normalize';

/**
 * 실시간 매장별 매출 — 오늘 하루.
 *
 * 갱신 정책: 이카운트가 10분 주기로 올라가지만 최종 반영까지 12분쯤 걸린다.
 * 그래서 15분으로 잡는다 — 적재 주기에 맞춰 10분으로 두면 아직 안 들어온 값을 부르게 된다.
 *   · 15분마다 자동 갱신
 *   · 단, 탭이 보일 때만 — 열어두고 방치한 창이 계속 호출하지 않게
 *   · 다른 탭에 있다가 돌아오면 즉시 한 번 갱신
 *   · 수동 버튼으로 언제든 갱신
 *
 * 매장 행을 누르면 그 매장이 오늘 무엇을 팔았는지 펼쳐진다. 상품명·색상이
 * 원 데이터에 이미 들어 있어 추가 호출은 없다.

 */
const REFRESH_MS = 15 * 60_000;
const fmt = (n) => Math.round(n || 0).toLocaleString();
const won = (n) => `${fmt(n)}원`;
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export default function TodaySales() {
  const [tick, setTick] = useState(0);
  const [openStore, setOpenStore] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const today = todayKST();

  const data = useAsync(async () => {
    const month = today.slice(0, 7);
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

    const [json, seatRes] = await Promise.all([
      rtGet('api/orders', { month, store: 'all' }),
      // 좌수 원장은 1.7MB 라 dash 서버가 날짜·매장·사람으로 접어 내려준다
      fetch(`/api/seats?month=${month}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ]);
    const seats = seatRes?.stores || {};

    const lines = (json?.orders || []).filter(
      (o) =>
        String(o.date || '').slice(0, 10) === today &&
        !isExcludedProduct(o.productName) &&
        !isExcludedStore(o.store),
    );

    setFetchedAt(new Date());
    return { lines, seats };
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
    const lines = data.data?.lines || [];
    const seats = data.data?.seats || {};
    const byStore = new Map();
    for (const o of lines) {
      const s = o.store || '미지정';
      if (!byStore.has(s)) byStore.set(s, []);
      byStore.get(s).push(o);
    }
    // 오늘 판매가 없어도 좌수는 있다 — 매출이 0이라고 매장이 사라지면
    // 아침에는 표가 통째로 비어 좌수를 볼 수 없다.
    for (const st of Object.keys(seats)) if (!byStore.has(st)) byStore.set(st, []);

    const rows = [...byStore.entries()]
      .map(([store, ls]) => {
        const amount = ls.reduce((a, o) => a + Number(o.amount || 0), 0);
        const oc = buildRawOrders(ls).length;
        const qty = ls.reduce((a, o) => a + Number(o.qty || 1), 0);

        // 같은 상품·색상은 한 줄로 합친다 — 무엇이 팔렸는지 보려는 것이지
        // 주문 하나하나를 보려는 게 아니다.
        const byItem = new Map();
        for (const o of ls) {
          const name = o.productName || '(상품명 없음)';
          const color = o.color || '';
          const key = `${name}|${color}`;
          const cur = byItem.get(key) || { name, color, qty: 0, amount: 0, lines: 0 };
          cur.qty += Number(o.qty || 1);
          cur.amount += Number(o.amount || 0);
          cur.lines += 1;
          byItem.set(key, cur);
        }
        const items = [...byItem.values()].sort((a, b) => b.amount - a.amount);

        const seat = seats[store] || null;
        return {
          store, amount, oc, qty, aov: oc ? amount / oc : 0, items,
          seatToday: seat?.today ?? null,
          seatCount: seat?.month ?? null,
          seatTarget: seat?.target ?? null,
          seatRate: seat?.target ? (seat.month / seat.target) * 100 : null,
          seatPeople: seat?.people || [],
        };
      })
      .filter((r) => r.amount > 0 || r.seatCount)
      .sort((a, b) => b.amount - a.amount || (b.seatCount || 0) - (a.seatCount || 0));

    const total = rows.reduce(
      (a, r) => ({
        amount: a.amount + r.amount, oc: a.oc + r.oc, qty: a.qty + r.qty,
        seatToday: a.seatToday + (r.seatToday || 0),
        seatCount: a.seatCount + (r.seatCount || 0), seatTarget: a.seatTarget + (r.seatTarget || 0),
      }),
      { amount: 0, oc: 0, qty: 0, seatToday: 0, seatCount: 0, seatTarget: 0 },
    );
    return { rows, total };
  }, [data.data]);

  const max = Math.max(1, ...rows.map((r) => r.amount));
  // 좌수 달성률을 색으로 가르는 기준 — 이번 달이 지난 만큼은 왔어야 한다
  const expectedPct = (Number(today.slice(8, 10)) / new Date(
    Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0,
  ).getDate()) * 100;

  return (
    <>
      <div className="toolbar">
        <span className="badge live-badge">● 실시간 · 15분마다 자동 갱신</span>
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
                <th className="right" title="오늘 등록된 좌수 — 오늘 매출과 같은 기준">좌수(오늘)</th>
                <th className="right" title="이번 달 누적 좌수 / 목표">좌수(이번 달)</th>
                <th style={{ width: 140 }}>비중</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const on = openStore === r.store;
                return (
                  <Fragment key={r.store}>
                    <tr
                      className={`row-click ${on ? 'row-open' : ''}`}
                      onClick={() => setOpenStore(on ? null : r.store)}
                      title={on ? '접기' : '판매 상품 보기'}
                    >
                      <td className="center"><span className="rank-badge">{i + 1}</span></td>
                      <td className="strong">
                        <span className="row-caret">{on ? '▾' : '▸'}</span> {r.store}
                      </td>
                      <td className="right mono strong">{won(r.amount)}</td>
                      <td className="right mono">{fmt(r.oc)}건</td>
                      <td className="right mono dim">{fmt(r.qty)}</td>
                      <td className="right mono">{won(r.aov)}</td>
                      <td className="right mono">
                        {r.seatToday ? <b>{fmt(r.seatToday)}</b> : <span className="qty-none">-</span>}
                      </td>
                      <td className="right mono">
                        {r.seatCount == null ? <span className="qty-none">-</span> : (
                          <>
                            {fmt(r.seatCount)}
                            {r.seatTarget ? <span className="dim">{' / '}{fmt(r.seatTarget)}</span> : null}
                            {r.seatRate != null && (
                              <span className={`seat-rate ${r.seatRate >= expectedPct ? 'up' : 'down'}`}>
                                {r.seatRate.toFixed(0)}%
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td><div className="minibar"><div style={{ width: `${(r.amount / max) * 100}%` }} /></div></td>
                    </tr>
                    {on && (
                      <tr className="sub-row">
                        <td />
                        <td colSpan={6}>
                          <StoreItems items={r.items} people={r.seatPeople} expected={expectedPct} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="total-row">
                <td />
                <td><strong>합계 · {rows.length}개 매장</strong></td>
                <td className="right mono"><strong>{won(total.amount)}</strong></td>
                <td className="right mono">{fmt(total.oc)}건</td>
                <td className="right mono">{fmt(total.qty)}</td>
                <td className="right mono">{won(total.oc ? total.amount / total.oc : 0)}</td>
                <td className="right mono"><strong>{fmt(total.seatToday)}</strong></td>
                <td className="right mono">
                  {total.seatCount ? (
                    <>
                      <strong>{fmt(total.seatCount)}</strong>
                      <span className="dim"> / {fmt(total.seatTarget)}</span>
                    </>
                  ) : <span className="qty-none">-</span>}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** 한 매장을 펼쳤을 때 — 오늘 판 것과, 이번 달 사람별 좌수 */
function StoreItems({ items, people, expected }) {
  const max = Math.max(1, ...(items || []).map((i) => i.amount));

  return (
    <div className="store-items">
      {people?.length > 0 && (
        <>
          <p className="summary">이번 달 좌수 <b>{people.length}명</b></p>
          <table className="table table-sub" style={{ marginBottom: 14 }}>
            <thead>
              <tr>
                <th>이름</th>
                <th>직급</th>
                <th className="right">오늘</th>
                <th className="right">이번 달</th>
                <th className="right">목표</th>
                <th className="right">달성</th>
              </tr>
            </thead>
            <tbody>
              {people.map((m) => (
                <tr key={`${m.name}-${m.role}`}>
                  <td className="strong">{m.name}</td>
                  <td className="dim">{m.role || '-'}</td>
                  <td className="right mono">{m.today ? <b>{fmt(m.today)}</b> : <span className="qty-none">-</span>}</td>
                  <td className="right mono">{fmt(m.month)}</td>
                  <td className="right mono dim">{m.target ? fmt(m.target) : '-'}</td>
                  <td className="right mono">
                    {!m.target ? <span className="qty-none">-</span> : (
                      <span
                        className={`seat-rate ${(m.month / m.target) * 100 >= expected ? 'up' : 'down'}`}
                        style={{ border: 0, padding: 0, margin: 0 }}
                      >
                        {((m.month / m.target) * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!items?.length ? <p className="summary">오늘 판매 내역이 없습니다.</p> : (
        <>
      <p className="summary">오늘 판매 <b>{items.length}종</b></p>
      <table className="table table-sub">
        <thead>
          <tr>
            <th>상품</th>
            <th>색상</th>
            <th className="right">수량</th>
            <th className="right">매출</th>
            <th style={{ width: 110 }}>비중</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={`${it.name}|${it.color}`}>
              <td className="strong">{it.name}</td>
              <td className="dim">{it.color || '-'}</td>
              <td className="right mono">{fmt(it.qty)}</td>
              <td className="right mono">{won(it.amount)}</td>
              <td><div className="minibar"><div style={{ width: `${(it.amount / max) * 100}%` }} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
        </>
      )}
    </div>
  );
}

