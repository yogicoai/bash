'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { MiniBars } from '@/components/charts/Charts';
import { colorSwatch } from '@/lib/sales/config';
import { computeKpiMetrics, formatAmount } from '@/lib/sales/metrics';
import { buildComments, buildStoreInsight } from '@/lib/sales/insight';

/** 매장 분석 리포트 — 지표 카드 · 자동 총평 · 코멘트 · 월별 추이 · TOP5 */
export default function StoreReport({ rows, rawOrders, storeVisits, months, meta, selected, period, filtered, onOpenDetail, isNonColor }) {
  const [store, setStore] = useState('');
  const captureRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // 매장 목록이 바뀌면(기간 변경 등) 선택 유지, 없어졌으면 첫 매장으로
  useEffect(() => {
    if (!meta.stores.length) { setStore(''); return; }
    if (!meta.stores.includes(store)) setStore(meta.stores[0]);
  }, [meta.stores, store]);

  const report = useMemo(() => {
    if (!store) return null;

    // 매장은 이 리포트 매장으로 고정, 나머지 필터는 그대로 적용
    const all = rows.filter(
      (r) =>
        r.store === store &&
        selected.categories.has(r.category) &&
        selected.fills.has(r.fill) &&
        selected.products.has(r.productName),
    );
    const orders = rawOrders.filter((o) => o.store === store);
    const k = computeKpiMetrics(all, orders);
    const visits = storeVisits[store] || 0;
    const cvr = visits > 0 ? (k.oc / visits) * 100 : 0;

    // 전체 매장 평균 (비교 기준)
    const allStores = [...new Set(filtered.map((r) => r.store))];
    const ks = allStores.map((st) =>
      computeKpiMetrics(filtered.filter((r) => r.store === st), rawOrders.filter((o) => o.store === st)),
    );
    const n = ks.length || 1;
    const avg = {
      aov: ks.reduce((a, x) => a + x.aov, 0) / n,
      setRate: ks.reduce((a, x) => a + x.setRate, 0) / n,
      coverRate: ks.reduce((a, x) => a + x.coverRate, 0) / n,
      sofaRate: ks.reduce((a, x) => a + x.sofaRate, 0) / n,
    };

    const monthAmt = months.map((m) => all.filter((r) => r.month === m).reduce((a, r) => a + r.amount, 0));

    const prodAgg = {};
    for (const r of all) prodAgg[r.productName] = (prodAgg[r.productName] || 0) + r.qty;
    const topProd = Object.entries(prodAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const colorAgg = {};
    for (const r of all) if (!isNonColor(r.color)) colorAgg[r.color] = (colorAgg[r.color] || 0) + r.qty;
    const topColor = Object.entries(colorAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const fm = {};
    for (const r of all) fm[r.fill] = (fm[r.fill] || 0) + r.qty;
    const fillTotal = Object.values(fm).reduce((a, b) => a + b, 0) || 1;
    const premiumMix = (((fm['프리미엄'] || 0) + (fm['프리미엄EPP'] || 0) + (fm['프리미엄플러스'] || 0)) / fillTotal) * 100;

    const insight = buildStoreInsight({ store, k, avg, months, monthAmt, topProd, topColor, premiumMix });
    const comments = buildComments({ k, avg, months, rows: all, topProd, topColor });

    return { all, k, avg, cvr, monthAmt, topProd, topColor, insight, comments };
  }, [store, rows, rawOrders, storeVisits, months, selected, filtered, isNonColor]);

  async function downloadImage() {
    if (!captureRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `매장리포트_${store}_${period.start}_${period.end}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  }

  if (!meta.stores.length) {
    return <div className="chart-empty"><div className="chart-empty-ic">📋</div>분석할 매장이 없습니다</div>;
  }

  const deltaTag = (val, base, unit) => {
    if (base <= 0) return null;
    const d = val - base;
    const cls = Math.abs(d) < base * 0.05 ? 'flat' : d > 0 ? 'up' : 'down';
    return (
      <div className={`rm-delta ${cls}`}>
        평균 대비 {d > 0 ? '+' : ''}{unit === '원' ? Math.round(d).toLocaleString() : d.toFixed(1)}{unit}
      </div>
    );
  };

  return (
    <>
      <div className="card-head">
        <div>
          <h2>매장 분석 리포트</h2>
          <p>매장을 선택하면 핵심 지표·강점·개선점을 자동 분석한 리포트를 생성합니다</p>
        </div>
        <div className="card-actions">
          <select className="input select" value={store} onChange={(e) => setStore(e.target.value)}>
            {meta.stores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="btn" onClick={downloadImage} disabled={saving || !report}>
            {saving ? '저장 중…' : '↓ 이미지 저장'}
          </button>
        </div>
      </div>

      {report && (
        <div className="report" ref={captureRef}>
          <div className="report-header">
            <div className="report-store">{store}</div>
            <div className="report-period">분석 기간: {period.start} ~ {period.end}</div>
          </div>

          <div className="report-grid">
            <button type="button" className="report-metric rm-click" onClick={() => onOpenDetail(store, 'all')}>
              <div className="rm-label">총 매출 ›</div>
              <div className="rm-value">{formatAmount(report.k.totalAmount)}</div>
            </button>
            <button type="button" className="report-metric rm-click" onClick={() => onOpenDetail(store, 'all')}>
              <div className="rm-label">구매 건수 ›</div>
              <div className="rm-value">{report.k.oc.toLocaleString()}건</div>
            </button>
            <div className="report-metric">
              <div className="rm-label">객단가</div>
              <div className="rm-value">{report.k.aov.toLocaleString()}원</div>
              {deltaTag(report.k.aov, report.avg.aov, '원')}
            </div>
            <div className="report-metric">
              <div className="rm-label">전환율(CVR)</div>
              <div className="rm-value">{report.cvr > 0 ? report.cvr.toFixed(1) + '%' : '—'}</div>
            </div>
            <button type="button" className="report-metric rm-click" onClick={() => onOpenDetail(store, 'sofa')}>
              <div className="rm-label">소파 ›</div>
              <div className="rm-value">{report.k.sofaQty.toLocaleString()}개</div>
              <div className="rm-delta flat">비중 {report.k.sofaRate.toFixed(1)}%</div>
            </button>
            <button type="button" className="report-metric rm-click" onClick={() => onOpenDetail(store, 'bp')}>
              <div className="rm-label">바디필로우 ›</div>
              <div className="rm-value">{report.k.bpQty.toLocaleString()}개</div>
              <div className="rm-delta flat">비중 {report.k.bpRate.toFixed(1)}%</div>
            </button>
            <button type="button" className="report-metric rm-click" onClick={() => onOpenDetail(store, 'set')}>
              <div className="rm-label">세트 구매율 ›</div>
              <div className="rm-value">{report.k.setRate.toFixed(1)}%</div>
              {deltaTag(report.k.setRate, report.avg.setRate, '%')}
            </button>
            <button type="button" className="report-metric rm-click" onClick={() => onOpenDetail(store, 'cover')}>
              <div className="rm-label">커버 동시구매율 ›</div>
              <div className="rm-value">{report.k.coverRate.toFixed(1)}%</div>
              {deltaTag(report.k.coverRate, report.avg.coverRate, '%')}
            </button>
          </div>

          <div className="report-section">
            <div className="ai-insight">
              <div className="ai-insight-head"><span className="ai-badge">자동 분석</span> 매장 종합 분석</div>
              <p className="ai-insight-body">{report.insight.summary}</p>
              {report.insight.actions.length > 0 && (
                <div className="ai-actions">
                  <div className="ai-actions-title">💡 추천 액션</div>
                  {report.insight.actions.map((a) => (
                    <div className="ai-action" key={a}><span className="ai-action-dot" />{a}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="report-section">
            <h4>💬 핵심 지표 코멘트</h4>
            {report.comments.map((c, i) => (
              <div className={`report-comment ${c.type}`} key={i}>
                <span className="ic">{c.type === 'good' ? '✅' : c.type === 'warn' ? '⚠️' : '•'}</span>
                <div>{c.text}</div>
              </div>
            ))}
          </div>

          <div className="report-section">
            <h4>📅 월별 매출 추이</h4>
            <MiniBars labels={months.map((m) => `${m.slice(5)}월`)} values={report.monthAmt} />
          </div>

          <div className="report-two">
            <div className="report-section">
              <h4>🏆 인기 제품 TOP 5</h4>
              {report.topProd.length === 0 ? <div className="small">데이터 없음</div> : report.topProd.map(([n, q], i) => (
                <div className="modal-prod" key={n}>
                  <div className={`modal-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                  <div className="modal-pname">{n}</div>
                  <div className="modal-pqty"><b>{q.toLocaleString()}</b></div>
                </div>
              ))}
            </div>
            <div className="report-section">
              <h4>🎨 인기 커버 색상 TOP 5</h4>
              {report.topColor.length === 0 ? <div className="small">데이터 없음</div> : report.topColor.map(([n, q], i) => (
                <div className="modal-prod" key={n}>
                  <div className={`modal-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                  <div className="modal-pname">
                    <span className="color-dot" style={{ background: colorSwatch(n) }} />{n}
                  </div>
                  <div className="modal-pqty"><b>{q.toLocaleString()}</b></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
