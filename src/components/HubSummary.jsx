'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildRawOrders } from '@/lib/sales/normalize';

/**
 * 허브 요약 — 클릭하지 않고도 오늘 상태가 보이게.
 * 화면들이 이미 쓰는 API를 그대로 재사용한다(새 백엔드 없음).
 *   /api/months + /api/orders   이번 달 오프라인 실적
 *   /api/jwasu/dashboard        좌수왕 선두
 *   /api/stock/전체             물류센터 소진임박
 */
const fmt = (n) => Math.round(n || 0).toLocaleString();
const won = (n) => `${fmt(n)}원`;

export default function HubSummary() {
  const sales = useAsync(async () => {
    const m = await rtGet('api/months');
    const month = [...(m?.months || [])].sort().pop();
    if (!month) return null;
    const json = await rtGet('api/orders', { month, store: 'all' });
    const lines = (json?.orders || []).filter(
      (o) => !isExcludedProduct(o.productName) && !isExcludedStore(o.store),
    );
    const orders = buildRawOrders(lines.map((o) => ({ ...o, amount: Number(o.amount || 0) })));
    const amount = lines.reduce((a, o) => a + Number(o.amount || 0), 0);
    return { month, amount, oc: orders.length, aov: orders.length ? amount / orders.length : 0 };
  }, []);

  const jwasu = useAsync(async () => {
    const m = await rtGet('api/months');
    const month = [...(m?.months || [])].sort().pop();
    const [y, mm] = month.split('-').map(Number);
    const end = `${month}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`;
    const json = await rtGet('api/jwasu/dashboard', {
      searchType: 'month', month, date: end, startDate: `${month}-01`, endDate: end,
    });
    const rows = (json?.data || [])
      .filter((r) => r.managerName && r.managerName !== 'system_store_placeholder' && Number(r.targetCount) > 0)
      .map((r) => ({ ...r, rate: (Number(r.count) || 0) / Number(r.targetCount) * 100 }))
      .sort((a, b) => b.rate - a.rate);
    return rows[0] || null;
  }, []);

  const stock = useAsync(async () => {
    const raw = await rtGet('api/stock/전체');
    const rows = (Array.isArray(raw) ? raw : []).filter(
      (i) => i.category !== '제외' && !String(i.name || '').toUpperCase().includes('EPP'),
    );
    return { critical: rows.filter((i) => i.qty > 0 && i.qty <= 3).length, out: rows.filter((i) => i.qty <= 0).length };
  }, []);

  const tiles = useMemo(() => [
    {
      href: '/sales/analysis',
      label: sales.data ? `${sales.data.month.slice(5)}월 오프라인 매출` : '오프라인 매출',
      value: sales.data ? won(sales.data.amount) : null,
      sub: sales.data ? `구매 ${fmt(sales.data.oc)}건 · 객단가 ${won(sales.data.aov)}` : null,
      state: sales,
    },
    {
      href: '/yleague/status',
      label: '좌수왕 선두',
      value: jwasu.data ? jwasu.data.managerName : null,
      sub: jwasu.data ? `${jwasu.data.storeName} · ${jwasu.data.rate.toFixed(1)}%` : null,
      state: jwasu,
    },
    {
      href: '/stock/center',
      label: '물류센터 소진임박',
      value: stock.data ? `${fmt(stock.data.critical)}건` : null,
      sub: stock.data ? `수량 3개 이하 · 품절 ${fmt(stock.data.out)}건` : null,
      tone: stock.data && stock.data.critical > 0 ? 'warn' : null,
      state: stock,
    },
  ], [sales, jwasu, stock]);

  return (
    <section className="hub">
      {tiles.map((t) => (
        <Link className={`hub-tile ${t.tone ? `hub-${t.tone}` : ''}`} href={t.href} key={t.label}>
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
        </Link>
      ))}
    </section>
  );
}
