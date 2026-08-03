'use client';

import { useEffect, useMemo } from 'react';
import { MiniBars } from '@/components/charts/Charts';
import { formatAmount } from '@/lib/sales/metrics';

/**
 * 공통 상세 팝업.
 * KPI 카드 · 충전재 · 카테고리 · 색상 · 매장 리포트 지표에서 모두 이걸 연다.
 *
 * countMode:
 *   'order' → 주문(건) 단위 집계 — 세트/커버처럼 "그 주문에 포함된 제품"을 볼 때
 *   기본     → 판매수량 집계
 */
export default function DetailModal({ detail, onClose }) {
  useEffect(() => {
    if (!detail) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detail, onClose]);

  const agg = useMemo(() => {
    if (!detail) return null;
    const { rows, groupLabel, countMode } = detail;

    const totalQty = rows.reduce((a, r) => a + r.qty, 0);
    const totalAmount = rows.reduce((a, r) => a + r.amount, 0);
    const productCount = new Set(rows.map((r) => r.productName)).size;
    const orderCount = new Set(rows.map((r) => r.orderNo).filter(Boolean)).size;

    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.productName))
        map.set(r.productName, {
          name: r.productName,
          sub: groupLabel === '카테고리' ? r.category : r.fill,
          qty: 0,
          amount: 0,
          orders: new Set(),
        });
      const e = map.get(r.productName);
      e.qty += r.qty;
      e.amount += r.amount;
      if (r.orderNo) e.orders.add(r.orderNo);
    }
    const list = [...map.values()]
      .map((r) => ({ ...r, orderCnt: r.orders.size }))
      .sort((a, b) => (countMode === 'order' ? b.orderCnt - a.orderCnt : b.qty - a.qty));

    const months = [...new Set(rows.map((r) => r.month).filter(Boolean))].sort();
    const monthTotals = months.map((m) => {
      const mr = rows.filter((r) => r.month === m);
      return countMode === 'order' ? new Set(mr.map((r) => r.orderNo).filter(Boolean)).size : mr.reduce((a, r) => a + r.qty, 0);
    });

    return { totalQty, totalAmount, productCount, orderCount, list, months, monthTotals };
  }, [detail]);

  if (!detail || !agg) return null;

  const { eyebrow, title, color, monthly, countMode } = detail;
  const max = Math.max(1, ...agg.list.map((r) => (countMode === 'order' ? r.orderCnt : r.qty)));

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">{eyebrow}</div>
            <h3>{title}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-summary">
          <div className="modal-stat">
            <div className="modal-stat-label">총 판매수량</div>
            <div className="modal-stat-value" style={{ color }}>{agg.totalQty.toLocaleString()}개</div>
          </div>
          <div className="modal-stat">
            <div className="modal-stat-label">제품 종류</div>
            <div className="modal-stat-value">{agg.productCount.toLocaleString()}종</div>
          </div>
          <div className="modal-stat">
            <div className="modal-stat-label">주문 건수</div>
            <div className="modal-stat-value">{agg.orderCount.toLocaleString()}건</div>
          </div>
          <div className="modal-stat">
            <div className="modal-stat-label">매출액</div>
            <div className="modal-stat-value">{formatAmount(agg.totalAmount)}</div>
          </div>
        </div>

        <div className="modal-body">
          {monthly && agg.months.length > 0 && (
            <div className="modal-trend">
              <div className="modal-section-title">📅 월별 추이 ({countMode === 'order' ? '건' : '개'})</div>
              <MiniBars
                labels={agg.months.map((m) => `${m.slice(5)}월`)}
                values={agg.monthTotals}
                color={color}
                height={130}
                format={(v) => v.toLocaleString()}
              />
            </div>
          )}

          {agg.list.length === 0 ? (
            <div className="chart-empty" style={{ margin: 14 }}>
              <div className="chart-empty-ic">📦</div>해당 조건의 제품이 없습니다
            </div>
          ) : (
            <>
              <div className="modal-section-title" style={{ padding: '6px 14px 2px' }}>
                🏆 {countMode === 'order' ? '많이 팔린 구성 제품' : '제품별 순위'}
              </div>
              {agg.list.map((r, i) => {
                const val = countMode === 'order' ? r.orderCnt : r.qty;
                const share = agg.totalQty > 0 ? (r.qty / agg.totalQty) * 100 : 0;
                return (
                  <div className="modal-prod" key={r.name}>
                    <div className={`modal-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                    <div className="modal-pname">
                      {r.name}
                      <small>{r.sub || ''} · 비중 {share.toFixed(1)}%</small>
                    </div>
                    <div className="modal-pqty">
                      <b>{val.toLocaleString()}{countMode === 'order' ? '건' : ''}</b>
                      <small>{r.qty.toLocaleString()}개 · {formatAmount(r.amount)}</small>
                    </div>
                    <div className="modal-bar">
                      <div style={{ width: `${(val / max) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
