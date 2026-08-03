'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import TodaySales from '@/app/sales/today/TodaySales';
import { useViewMode } from './ViewMode';
import { onGet, rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildRawOrders } from '@/lib/sales/normalize';

/**
 * 허브 요약 — 오늘 매출을 채널별로. 클릭하지 않고도 보이게 한다.
 *
 * 갱신 시점이 다르므로 라벨로 구분한다.
 *   실시간 매출 = 오프라인 매장 당일 (이카운트 10분 주기)
 *   월별 매출   = 매일 오전 10시 기준, 어제까지 반영된 누적
 *
 * 실시간으로 볼 수 있는 범위만 얹는다.
 *   오프라인 : 매장 전체 (이카운트 10분 주기)   realtime /api/orders
 *   온라인   : Cafe24  onlineData /api/cafe24/daily-summary (당월 누적)
 *              스마트스토어 onlineData /api/smartstore/analysis (당월 1일~오늘)
 * ※ /api/sync-today · /api/refresh-today 는 동기화 작업을 실행시키는 엔드포인트라 여기서 부르지 않는다.
 * 외부몰(쿠팡·오늘의집 등)은 이카운트 일 단위라 여기 넣지 않는다 — 넣으면 당월 초에 0으로 보인다.
 *
 * 새 백엔드 없이 각 화면이 이미 쓰는 API를 그대로 재사용한다.
 */
const fmt = (n) => Math.round(n || 0).toLocaleString();
const won = (n) => `${fmt(n)}원`;
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export default function HubSummary() {
  const { mode } = useViewMode();
  const [openDetail, setOpenDetail] = useState(false);
  const detailRef = useRef(null);

  // 한 페이지 모드에서는 이동하지 않고 아래로 펼친 뒤 그 위치로 스크롤한다
  const toggleDetail = () => {
    const next = !openDetail;
    setOpenDetail(next);
    if (next) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const offline = useAsync(async () => {
    const m = await rtGet('api/months');
    const month = [...(m?.months || [])].sort().pop();
    if (!month) return null;

    const json = await rtGet('api/orders', { month, store: 'all' });
    const lines = (json?.orders || []).filter(
      (o) => !isExcludedProduct(o.productName) && !isExcludedStore(o.store),
    );
    const orders = buildRawOrders(lines.map((o) => ({ ...o, amount: Number(o.amount || 0) })));
    const amount = lines.reduce((a, o) => a + Number(o.amount || 0), 0);

    const today = todayKST();
    const todayLines = lines.filter((o) => String(o.date || '').slice(0, 10) === today);
    const todayAmount = todayLines.reduce((a, o) => a + Number(o.amount || 0), 0);
    const todayOrders = buildRawOrders(todayLines).length;

    return { month, amount, oc: orders.length, aov: orders.length ? amount / orders.length : 0, todayAmount, todayOrders };
  }, []);

  // Cafe24 — 당월 누적
  const cafe24 = useAsync(async () => {
    const json = await onGet('api/cafe24/daily-summary', { date: todayKST() });
    const d = json?.daily;
    if (!d) return null;
    return { revenue: d.revenue, rate: d.rate, prev: d.prevRevenue };
  }, []);

  /**
   * 스마트스토어 — 오늘.
   * 동기화가 밀려 있으면 매출이 0으로 나온다. 그대로 두면 "판매 없음"으로 읽히므로
   * 동기화 상태(meta.to)를 같이 보고 뒤처져 있으면 숫자 대신 그 사실을 표시한다.
   */
  const smartstore = useAsync(async () => {
    const today = todayKST();
    const [json, status] = await Promise.all([
      onGet('api/smartstore/analysis', { start: today, end: today }),
      onGet('api/smartstore/status').catch(() => null),
    ]);
    const k = json?.kpis;
    if (!k) return null;
    const syncedTo = status?.meta?.to || null;
    return { revenue: k.revenue, orders: k.orders, syncedTo, stale: Boolean(syncedTo && syncedTo < today) };
  }, []);

  const pct = (r) => (typeof r === 'number' ? `${r > 0 ? '+' : ''}${(r * 100).toFixed(0)}%` : null);

  const tiles = [
    {
      href: '/sales/today',
      label: '오프라인 매장',
      value: offline.data ? won(offline.data.todayAmount) : null,
      sub: offline.data ? `구매 ${fmt(offline.data.todayOrders)}건` : null,
      state: offline,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      label: '자사몰 (Cafe24)',
      value: cafe24.data ? won(cafe24.data.revenue) : null,
      sub: cafe24.data
        ? `지난주 같은 요일 ${won(cafe24.data.prev)}${pct(cafe24.data.rate) ? ` · ${pct(cafe24.data.rate)}` : ''}`
        : null,
      state: cafe24,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      label: '스마트스토어',
      value: smartstore.data ? (smartstore.data.stale ? '동기화 필요' : won(smartstore.data.revenue)) : null,
      sub: smartstore.data
        ? smartstore.data.stale
          ? `${smartstore.data.syncedTo}까지만 반영됨 — 판매분석에서 재동기화`
          : `주문 ${fmt(smartstore.data.orders)}건`
        : null,
      tone: smartstore.data?.stale ? 'stale' : null,
      state: smartstore,
    },
  ];

  return (
    <>
      <div className="hub">
      {tiles.map((t) => {
        const body = (
          <>
            <div className="hub-label">{t.label}</div>
            {t.state.loading ? (
              <div className="hub-value hub-dim">불러오는 중…</div>
            ) : t.state.error || t.value === null ? (
              <div className="hub-value hub-dim">—</div>
            ) : (
              <>
                <div className="hub-value">{t.value}</div>
                {t.sub && <div className="hub-sub">{t.sub}</div>}
              </>
            )}
          </>
        );
        const cls = `hub-tile ${t.tone ? `hub-${t.tone}` : ''}`;

        // 오프라인 매장 타일 — 한 페이지 모드면 이동 대신 아래로 펼친다
        if (t.href === '/sales/today' && mode === 'popup') {
          return (
            <button
              type="button"
              className={`${cls} ${openDetail ? 'hub-open' : ''}`}
              onClick={toggleDetail}
              key={t.label}
            >
              {body}
              <span className="hub-more">{openDetail ? '접기 ▲' : '매장별 보기 ▼'}</span>
            </button>
          );
        }

        return t.external ? (
          <a className={cls} href={t.href} target="_blank" rel="noopener noreferrer" key={t.label}>{body}</a>
        ) : (
          <Link className={cls} href={t.href} key={t.label}>{body}</Link>
        );
      })}
      </div>

      {mode === 'popup' && openDetail && (
        <div className="hub-detail" ref={detailRef}>
          <div className="hub-detail-head">
            <h2>실시간 매장별 매출</h2>
            <button type="button" className="btn btn-sm" onClick={toggleDetail}>접기 ▲</button>
          </div>
          <TodaySales />
        </div>
      )}
    </>
  );
}
