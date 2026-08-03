'use client';

import Link from 'next/link';
import { onGet, rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildRawOrders } from '@/lib/sales/normalize';

/**
 * 허브 요약 — 클릭하지 않고도 매출이 보이게. 지표는 매출만 둔다.
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
    const mtd = json?.mtd;
    if (!mtd) return null;
    return { revenue: mtd.revenue, orders: mtd.orders, month: json.monthStart?.slice(0, 7) };
  }, []);

  // 스마트스토어 — 당월 1일 ~ 오늘
  const smartstore = useAsync(async () => {
    const today = todayKST();
    const json = await onGet('api/smartstore/analysis', { start: `${today.slice(0, 7)}-01`, end: today });
    const k = json?.kpis;
    if (!k) return null;
    return { revenue: k.revenue, orders: k.orders, month: today.slice(0, 7) };
  }, []);

  const tiles = [
    {
      href: '/sales/analysis',
      label: '실시간 매출 (오늘)',
      value: offline.data ? won(offline.data.todayAmount) : null,
      sub: offline.data
        ? `오프라인 매장 당일 · 구매 ${fmt(offline.data.todayOrders)}건`
        : null,
      tone: 'live',
      state: offline,
    },
    {
      href: '/sales/analysis',
      label: offline.data ? `${offline.data.month.slice(5)}월 매출 (오프라인)` : '월별 매출 (오프라인)',
      value: offline.data ? won(offline.data.amount) : null,
      sub: offline.data ? `구매 ${fmt(offline.data.oc)}건 · 객단가 ${won(offline.data.aov)}` : null,
      state: offline,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      label: cafe24.data ? `${(cafe24.data.month || '').slice(5)}월 매출 (자사몰)` : '월별 매출 (자사몰)',
      value: cafe24.data ? won(cafe24.data.revenue) : null,
      sub: cafe24.data ? `Cafe24 · 주문 ${fmt(cafe24.data.orders)}건` : null,
      state: cafe24,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      label: smartstore.data ? `${(smartstore.data.month || '').slice(5)}월 매출 (스마트스토어)` : '월별 매출 (스마트스토어)',
      value: smartstore.data ? won(smartstore.data.revenue) : null,
      sub: smartstore.data ? `네이버 · 주문 ${fmt(smartstore.data.orders)}건` : null,
      state: smartstore,
    },
  ];

  return (
    <section className="hub">
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
        return t.external ? (
          <a className={cls} href={t.href} target="_blank" rel="noopener noreferrer" key={t.label}>{body}</a>
        ) : (
          <Link className={cls} href={t.href} key={t.label}>{body}</Link>
        );
      })}
    </section>
  );
}
