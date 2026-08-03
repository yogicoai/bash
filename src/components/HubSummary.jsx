'use client';

import Link from 'next/link';
import { onGet, rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildRawOrders } from '@/lib/sales/normalize';

/**
 * 허브 요약 — 클릭하지 않고도 지금 상태가 보이게.
 *
 * 실시간으로 볼 수 있는 범위만 얹는다.
 *   오프라인 : 매장 전체 (이카운트 10분 주기)   realtime /api/orders
 *   온라인   : Cafe24 · 스마트스토어            onlineData /api/cafe24/daily-summary (당월 누적)
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

    const byStore = new Map();
    for (const o of lines) byStore.set(o.store, (byStore.get(o.store) || 0) + Number(o.amount || 0));
    const [topStore, topAmount] = [...byStore.entries()].sort((a, b) => b[1] - a[1])[0] || [];

    return { month, amount, oc: orders.length, aov: orders.length ? amount / orders.length : 0, topStore, topAmount };
  }, []);

  const online = useAsync(async () => {
    const json = await onGet('api/cafe24/daily-summary', { date: todayKST() });
    const mtd = json?.mtd;
    if (!mtd) return null;
    return { revenue: mtd.revenue, orders: mtd.orders, aov: mtd.aov, basis: mtd.basis, month: json.monthStart?.slice(0, 7) };
  }, []);

  const stock = useAsync(async () => {
    const raw = await rtGet('api/stock/전체');
    const rows = (Array.isArray(raw) ? raw : []).filter(
      (i) => i.category !== '제외' && !String(i.name || '').toUpperCase().includes('EPP'),
    );
    return { critical: rows.filter((i) => i.qty > 0 && i.qty <= 3).length, out: rows.filter((i) => i.qty <= 0).length };
  }, []);

  const tiles = [
    {
      href: '/sales/analysis',
      label: offline.data ? `${offline.data.month.slice(5)}월 오프라인 매출` : '오프라인 매출',
      value: offline.data ? won(offline.data.amount) : null,
      sub: offline.data ? `구매 ${fmt(offline.data.oc)}건 · 객단가 ${won(offline.data.aov)}` : null,
      state: offline,
    },
    {
      href: '/sales/analysis',
      label: '오프라인 매출 1위 매장',
      value: offline.data?.topStore || null,
      sub: offline.data?.topStore ? won(offline.data.topAmount) : null,
      state: offline,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      label: online.data ? `${(online.data.month || '').slice(5)}월 온라인 매출` : '온라인 매출',
      value: online.data ? won(online.data.revenue) : null,
      sub: online.data ? `Cafe24 기준 · 주문 ${fmt(online.data.orders)}건` : null,
      state: online,
    },
    {
      href: '/stock/center',
      label: '물류센터 소진임박',
      value: stock.data ? `${fmt(stock.data.critical)}건` : null,
      sub: stock.data ? `수량 3개 이하 · 품절 ${fmt(stock.data.out)}건` : null,
      tone: stock.data && stock.data.critical > 0 ? 'warn' : null,
      state: stock,
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
