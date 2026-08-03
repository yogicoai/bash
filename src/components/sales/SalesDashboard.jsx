'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, LineChart, RankBarChart, ShareBar, Sparkline, StackedBarChart } from '@/components/charts/Charts';
import DetailModal from './DetailModal';
import StoreReport from './StoreReport';
import { KPI_LINES, VARIANTS, categoryColor, colorSwatch, makeIsNonColor } from '@/lib/sales/config';
import { computeKpiMetrics, computeKpiSeries, computeStoreStats, formatAmount } from '@/lib/sales/metrics';
import { useSalesData } from '@/hooks/useSalesData';

const TABS = [
  { key: 'store', label: '매장별 비교' },
  { key: 'report', label: '매장 리포트' },
  { key: 'fill', label: '충전재별 비중' },
  { key: 'category', label: '카테고리 분포' },
  { key: 'monthly', label: '월별 추이' },
  { key: 'top', label: '제품 TOP' },
  { key: 'color', label: '인기 커버 색상' },
  { key: 'weekday', label: '요일별 패턴' },
  { key: 'kpi', label: '통합 KPI 추이' },
  { key: 'table', label: '상세 표' },
];

const PRESETS = [
  { key: 1, label: '이번 달' },
  { key: 3, label: '최근 3개월' },
  { key: 6, label: '최근 6개월' },
  { key: 12, label: '최근 12개월' },
  { key: 'all', label: '전체' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const emptySel = () => ({ stores: new Set(), categories: new Set(), fills: new Set(), products: new Set() });

/**
 * variantKey만 받는다 — 설정에 RegExp가 들어 있어서 서버 컴포넌트에서
 * 객체째로 넘기면 직렬화 경계를 넘지 못한다.
 */
export default function SalesDashboard({ variantKey }) {
  const variant = VARIANTS[variantKey];
  const data = useSalesData(variant);
  const { rows, orders: rawOrders, monthlyVisits, storeVisits, meta, months, period, loading, error, partial } = data;

  const isNonColor = useMemo(() => makeIsNonColor(variant), [variant]);

  const [selected, setSelected] = useState(emptySel);
  const [storeSearch, setStoreSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [tab, setTab] = useState('store');
  const [detail, setDetail] = useState(null);

  const [storeSort, setStoreSort] = useState('amount');
  const [topMode, setTopMode] = useState('all');
  const [colorMode, setColorMode] = useState('all');
  const [weekdayMode, setWeekdayMode] = useState('qty');
  const [kpiMetric, setKpiMetric] = useState('all');
  const [categoryMode, setCategoryMode] = useState('share');
  const [hiddenFills, setHiddenFills] = useState(() => new Set());

  // 기간이 바뀌어 메타가 새로 만들어지면 전체 선택으로 초기화
  const metaSig = `${meta.stores.join('|')}##${meta.categories.join('|')}##${meta.fills.join('|')}##${meta.products.length}`;
  useEffect(() => {
    setSelected({
      stores: new Set(meta.stores),
      categories: new Set(meta.categories),
      fills: new Set(meta.fills),
      products: new Set(meta.products),
    });
    setHiddenFills(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaSig]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          selected.stores.has(r.store) &&
          selected.categories.has(r.category) &&
          selected.fills.has(r.fill) &&
          selected.products.has(r.productName),
      ),
    [rows, selected],
  );
  const filteredOrders = useMemo(() => rawOrders.filter((o) => selected.stores.has(o.store)), [rawOrders, selected]);

  const monthLabels = useMemo(() => months.map((m) => `${m.slice(5)}월`), [months]);

  // ── 액션 ──
  const toggleItem = (name, item) =>
    setSelected((s) => {
      const next = new Set(s[name]);
      next.has(item) ? next.delete(item) : next.add(item);
      return { ...s, [name]: next };
    });
  const selectAll = (name) => setSelected((s) => ({ ...s, [name]: new Set(meta[name]) }));
  const clearSet = (name) => setSelected((s) => ({ ...s, [name]: new Set() }));
  const resetAll = () => {
    setSelected({
      stores: new Set(meta.stores),
      categories: new Set(meta.categories),
      fills: new Set(meta.fills),
      products: new Set(meta.products),
    });
    setStoreSearch('');
    setProductSearch('');
  };

  const openDetail = (d) => setDetail(d);

  const openKpiDetail = (type) => {
    const map = {
      sofa: { eyebrow: '소파 구매 상세', title: '소파 구매 · 제품·월별', color: categoryColor('소파'), rows: filtered.filter((r) => r.category === '소파'), groupLabel: '충전재', monthly: true },
      bp: { eyebrow: '바디필로우 구매 상세', title: '바디필로우 · 제품·월별', color: categoryColor('바디필로우'), rows: filtered.filter((r) => r.category === '바디필로우'), groupLabel: '충전재', monthly: true },
      set: { eyebrow: '세트 구매 상세', title: '세트 구매 · 인기 구성 제품·월별', color: '#be185d', rows: filtered.filter((r) => r.orderHasSet), groupLabel: '카테고리', monthly: true, countMode: 'order' },
      cover: { eyebrow: '커버 동시 구매 상세', title: '커버 동시 구매 · 인기 제품·월별', color: '#0891b2', rows: filtered.filter((r) => r.orderHasCover), groupLabel: '카테고리', monthly: true, countMode: 'order' },
    };
    if (map[type]) openDetail(map[type]);
  };

  const openStoreDetail = (store, type) => {
    const base = rows.filter(
      (r) => r.store === store && selected.categories.has(r.category) && selected.fills.has(r.fill) && selected.products.has(r.productName),
    );
    const map = {
      sofa: { eyebrow: `${store} · 소파`, title: '소파 구매 · 제품·월별', color: categoryColor('소파'), rows: base.filter((r) => r.category === '소파'), groupLabel: '충전재', monthly: true },
      bp: { eyebrow: `${store} · 바디필로우`, title: '바디필로우 · 제품·월별', color: categoryColor('바디필로우'), rows: base.filter((r) => r.category === '바디필로우'), groupLabel: '충전재', monthly: true },
      set: { eyebrow: `${store} · 세트 구매`, title: '세트 구매 · 인기 구성 제품·월별', color: '#be185d', rows: base.filter((r) => r.orderHasSet), groupLabel: '카테고리', monthly: true, countMode: 'order' },
      cover: { eyebrow: `${store} · 커버 동시구매`, title: '커버 동시 구매 · 인기 제품·월별', color: '#0891b2', rows: base.filter((r) => r.orderHasCover), groupLabel: '카테고리', monthly: true, countMode: 'order' },
      all: { eyebrow: `${store} · 전체`, title: `${store} 전체 판매 · 제품·월별`, color: '#4f46e5', rows: base, groupLabel: '카테고리', monthly: true },
    };
    openDetail(map[type] || map.all);
  };

  function downloadCSV() {
    if (filtered.length === 0) return;
    const headers = ['월', '매장', '카테고리', '충전재', '제품명', '색상', '수량', '매출액'];
    const esc = (s) => {
      const v = String(s ?? '');
      return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const lines = [headers.join(',')];
    for (const r of filtered)
      lines.push([r.month, esc(r.store), r.category, r.fill, esc(r.productName), esc(r.color), r.qty, Math.round(r.amount)].join(','));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${variant.csvName}_${period.end || ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 집계 ──
  const kpi = useMemo(() => computeKpiMetrics(filtered, filteredOrders), [filtered, filteredOrders]);
  const totalVisits = useMemo(() => months.reduce((a, m) => a + (monthlyVisits[m] || 0), 0), [months, monthlyVisits]);
  const cvr = totalVisits > 0 ? (kpi.oc / totalVisits) * 100 : 0;

  const activeFills = useMemo(() => meta.fills.filter((f) => selected.fills.has(f)), [meta.fills, selected]);
  const visibleFills = useMemo(() => activeFills.filter((f) => !hiddenFills.has(f)), [activeFills, hiddenFills]);

  const fillGrid = useMemo(() => {
    const g = {};
    for (const m of months) {
      g[m] = { total: 0 };
      for (const k of variant.fillKeys) g[m][k] = 0;
    }
    for (const r of filtered) {
      if (!g[r.month]) continue;
      g[r.month][r.fill] = (g[r.month][r.fill] || 0) + r.qty;
      g[r.month].total += r.qty;
    }
    return g;
  }, [filtered, months, variant]);

  const storeStats = useMemo(() => {
    const stats = computeStoreStats(filtered, rawOrders, storeVisits);
    stats.sort((a, b) => (storeSort === 'qty' ? b.totalQty - a.totalQty : storeSort === 'aov' ? b.aov - a.aov : b.totalAmount - a.totalAmount));
    return stats;
  }, [filtered, rawOrders, storeVisits, storeSort]);

  const kpiSeries = useMemo(
    () => computeKpiSeries(months, rawOrders, selected.stores, monthlyVisits),
    [months, rawOrders, selected, monthlyVisits],
  );

  const catQty = useMemo(() => {
    const m = {};
    for (const r of filtered) m[r.category] = (m[r.category] || 0) + r.qty;
    return m;
  }, [filtered]);

  const visibleCats = useMemo(
    () => meta.categories.filter((c) => selected.categories.has(c) && (catQty[c] || 0) > 0),
    [meta.categories, selected, catQty],
  );

  // ── 렌더 ──
  const filterCount = (k) => `${selected[k].size}/${meta[k].length}`;

  return (
    <>
      <section className="period-bar">
        <div className="period-title">
          <span className="period-icon">📅</span>
          <div>
            <div className="period-label">분석 기간</div>
            <div className="period-value">{loading ? '데이터 로딩 중…' : `${period.start} ~ ${period.end}`}</div>
          </div>
        </div>
        <div className="period-presets">
          {PRESETS.map((p) => (
            <button
              key={String(p.key)}
              type="button"
              className={`period-preset ${data.preset === p.key ? 'active' : ''}`}
              onClick={() => data.applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="period-custom">
          <input type="date" className="input" value={period.start || ''} min={data.bounds.min} max={data.bounds.max} onChange={(e) => data.applyCustom(e.target.value, period.end)} />
          <span className="period-dash">~</span>
          <input type="date" className="input" value={period.end || ''} min={data.bounds.min} max={data.bounds.max} onChange={(e) => data.applyCustom(period.start, e.target.value)} />
        </div>
        {loading && <div className="period-progress active" />}
      </section>

      {error && (
        <div className="state">
          <p className="state-icon">📭</p>
          <p className="state-title">{error.message}</p>
          <button type="button" className="btn" onClick={data.reload}>다시 시도</button>
        </div>
      )}

      {partial > 0 && (
        <div className="warn-banner">일부 월({partial}개)의 주문 데이터를 불러오지 못했습니다. 아래 수치는 나머지 월 기준입니다.</div>
      )}

      <section className="kpi-grid">
        <Kpi mark="🧾" label="총 구매 건수" value={`${kpi.oc.toLocaleString()}건`} sub="주문번호 기준" />
        <Kpi mark="🛋️" label="소파 구매" value={`${kpi.sofaQty.toLocaleString()}개`} sub={`비중 ${kpi.sofaRate.toFixed(1)}%`} onClick={() => openKpiDetail('sofa')} />
        <Kpi mark="🛏️" label="바디필로우" value={`${kpi.bpQty.toLocaleString()}개`} sub={`비중 ${kpi.bpRate.toFixed(1)}%`} onClick={() => openKpiDetail('bp')} />
        <Kpi mark="🎁" label="세트 구매" value={`${kpi.setCount.toLocaleString()}건`} sub={`구매율 ${kpi.setRate.toFixed(1)}%`} onClick={() => openKpiDetail('set')} />
        <Kpi mark="🧺" label="커버 동시 구매" value={`${kpi.coverCount.toLocaleString()}건`} sub={`구매율 ${kpi.coverRate.toFixed(1)}%`} onClick={() => openKpiDetail('cover')} />
        <Kpi mark="💎" label="객단가" value={`${kpi.aov.toLocaleString()}원`} sub="매출 ÷ 구매건수" dark />
        <Kpi mark="📈" label="전환율 (CVR)" value={`${cvr.toFixed(1)}%`} sub={`방문 합계 ${totalVisits.toLocaleString()}명`} dark />
      </section>

      <section className="sales-layout">
        <aside className="filter-panel">
          <div className="filter-head">
            <h3>필터 선택</h3>
            <button type="button" className="btn btn-sm" onClick={resetAll}>초기화</button>
          </div>

          <FilterSection title="🏬 매장" count={filterCount('stores')} onAll={() => selectAll('stores')} onNone={() => clearSet('stores')}>
            <input className="input filter-search" placeholder="매장명 검색…" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} />
            <ChipGroup items={meta.stores.filter((s) => s.toLowerCase().includes(storeSearch.toLowerCase()))} active={selected.stores} onToggle={(v) => toggleItem('stores', v)} />
          </FilterSection>

          <FilterSection title="📦 카테고리" count={filterCount('categories')} onAll={() => selectAll('categories')} onNone={() => clearSet('categories')}>
            <ChipGroup items={meta.categories} active={selected.categories} onToggle={(v) => toggleItem('categories', v)} />
          </FilterSection>

          <FilterSection title="🧶 충전재" count={filterCount('fills')} onAll={() => selectAll('fills')} onNone={() => clearSet('fills')}>
            <ChipGroup items={meta.fills} active={selected.fills} onToggle={(v) => toggleItem('fills', v)} />
          </FilterSection>

          <FilterSection title="🛋️ 제품" count={filterCount('products')} onAll={() => selectAll('products')} onNone={() => clearSet('products')}>
            <input className="input filter-search" placeholder="제품명 검색…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            {productSearch ? (
              <ChipGroup items={meta.products.filter((p) => p.toLowerCase().includes(productSearch.toLowerCase()))} active={selected.products} onToggle={(v) => toggleItem('products', v)} />
            ) : (
              <span className="chip chip-static">
                전체 {meta.products.length.toLocaleString()}개 제품{' '}
                {selected.products.size === meta.products.length ? '포함' : `${selected.products.size}개 선택`} · 검색해서 좁히기
              </span>
            )}
          </FilterSection>
        </aside>

        <main className="sales-main">
          <div className="summary-pill">
            <span className="dot" />
            <span>
              기간 <b>{months.length}개월</b> · 매장 <b>{filterCount('stores')}</b> · 카테고리 <b>{filterCount('categories')}</b> ·
              충전재 <b>{filterCount('fills')}</b> · 제품 <b>{filterCount('products')}</b> · 라인 <b>{filtered.length.toLocaleString()}건</b>
            </span>
          </div>

          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="card">
            {tab === 'store' && (
              <>
                <div className="card-head">
                  <div>
                    <h2>매장별 비교 분석</h2>
                    <p>선택 기간·조건 기준으로 매장별 핵심 지표를 한눈에 비교</p>
                  </div>
                  <div className="card-actions">
                    <Seg value={storeSort} onChange={setStoreSort} options={[['amount', '매출순'], ['qty', '수량순'], ['aov', '객단가순']]} />
                  </div>
                </div>
                <StoreCompareTable stats={storeStats} />
              </>
            )}

            {tab === 'report' && (
              <StoreReport
                rows={rows}
                rawOrders={rawOrders}
                storeVisits={storeVisits}
                months={months}
                meta={meta}
                selected={selected}
                period={period}
                filtered={filtered}
                onOpenDetail={openStoreDetail}
                isNonColor={isNonColor}
              />
            )}

            {tab === 'fill' && (
              <>
                <div className="card-head">
                  <div>
                    <h2>충전재별 판매비중</h2>
                    <p>{variant.fillNote}</p>
                  </div>
                </div>
                {months.length === 1 ? (
                  <BarChart
                    height={400}
                    yFormat={(v) => `${Math.round(v)}%`}
                    valueFormat={(v) => `${v.toFixed(1)}%`}
                    data={visibleFills.map((fk) => {
                      const total = fillGrid[months[0]]?.total || 0;
                      const qty = fillGrid[months[0]]?.[fk] || 0;
                      return {
                        label: fk,
                        value: total > 0 ? (qty / total) * 100 : 0,
                        subLabel: `${qty.toLocaleString()}개`,
                        color: variant.fillPalette[fk],
                        title: `${fk} · 클릭하여 제품 보기`,
                      };
                    })}
                    onBarClick={(d) =>
                      openDetail({ eyebrow: '충전재 상세', title: `${d.label} · ${months[0].slice(0, 4)}년 ${months[0].slice(5)}월`, color: variant.fillPalette[d.label], rows: filtered.filter((r) => r.fill === d.label && r.month === months[0]), groupLabel: '카테고리' })
                    }
                    emptyText="선택된 데이터가 없습니다"
                  />
                ) : (
                  <LineChart
                    xLabels={monthLabels}
                    area
                    series={visibleFills.map((fk) => ({
                      key: fk,
                      label: fk,
                      color: variant.fillPalette[fk],
                      values: months.map((m) => (fillGrid[m].total > 0 ? (fillGrid[m][fk] / fillGrid[m].total) * 100 : 0)),
                      fmt: (v) => `${v.toFixed(1)}%`,
                    }))}
                    onPointClick={(s, _label, i) =>
                      openDetail({ eyebrow: '충전재 상세', title: `${s.label} · ${months[i].slice(0, 4)}년 ${months[i].slice(5)}월`, color: s.color, rows: filtered.filter((r) => r.fill === s.key && r.month === months[i]), groupLabel: '카테고리' })
                    }
                    emptyText="선택된 데이터가 없습니다"
                  />
                )}
                <div className="legend">
                  <span className="legend-hint">💡 {months.length === 1 ? '막대' : '포인트'} 클릭=제품 보기 · 범례 클릭=켜기/끄기</span>
                  {activeFills.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`legend-toggle ${hiddenFills.has(f) ? 'off' : ''}`}
                      onClick={() =>
                        setHiddenFills((s) => {
                          const n = new Set(s);
                          n.has(f) ? n.delete(f) : n.add(f);
                          return n;
                        })
                      }
                    >
                      <span className="swatch" style={{ background: hiddenFills.has(f) ? '#475569' : variant.fillPalette[f] }} />
                      {f}
                    </button>
                  ))}
                </div>
                {months.length >= 2 && visibleFills.length > 0 && (
                  <div className="insight-row">
                    {visibleFills.map((fk) => {
                      const first = months[0], last = months[months.length - 1];
                      const fp = fillGrid[first].total > 0 ? (fillGrid[first][fk] / fillGrid[first].total) * 100 : 0;
                      const lp = fillGrid[last].total > 0 ? (fillGrid[last][fk] / fillGrid[last].total) * 100 : 0;
                      const diff = lp - fp;
                      const cls = diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'flat';
                      return (
                        <div className="insight" key={fk}>
                          <div className="insight-label">{fk}</div>
                          <div className="insight-value">
                            {lp.toFixed(1)}% <span className={`delta ${cls}`}>{diff > 0.5 ? '▲' : diff < -0.5 ? '▼' : '—'} {Math.abs(diff).toFixed(1)}p</span>
                          </div>
                          <div className="insight-sub">{first.slice(5)}월 {fp.toFixed(1)}% → {last.slice(5)}월 {lp.toFixed(1)}%</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {tab === 'category' && (
              <>
                <div className="card-head">
                  <div>
                    <h2>카테고리 분포</h2>
                    <p>카테고리별 판매수량 비중 · 월별 추이 토글 가능</p>
                  </div>
                  <div className="card-actions">
                    <Seg value={categoryMode} onChange={setCategoryMode} options={[['share', '비중'], ['trend', '월별 추이']]} />
                  </div>
                </div>
                {categoryMode === 'share' ? (
                  <>
                    <ShareBar
                      items={visibleCats.map((c) => ({ name: c, value: catQty[c], color: categoryColor(c) })).sort((a, b) => b.value - a.value)}
                      onSegClick={(it) => openDetail({ eyebrow: '카테고리 상세', title: it.name, color: it.color, rows: filtered.filter((r) => r.category === it.name), groupLabel: '충전재' })}
                    />
                    <div className="insight-row">
                      {visibleCats
                        .slice()
                        .sort((a, b) => catQty[b] - catQty[a])
                        .map((c) => {
                          const grand = visibleCats.reduce((a, x) => a + catQty[x], 0);
                          const pct = grand > 0 ? (catQty[c] / grand) * 100 : 0;
                          return (
                            <button
                              key={c}
                              type="button"
                              className="insight insight-click"
                              style={{ borderColor: `${categoryColor(c)}66` }}
                              onClick={() => openDetail({ eyebrow: '카테고리 상세', title: c, color: categoryColor(c), rows: filtered.filter((r) => r.category === c), groupLabel: '충전재' })}
                            >
                              <div className="insight-label" style={{ color: categoryColor(c) }}>{c}</div>
                              <div className="insight-value">{pct.toFixed(1)}%</div>
                              <div className="insight-sub">{catQty[c].toLocaleString()}개 판매 · 클릭 ›</div>
                            </button>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <StackedBarChart
                    xLabels={monthLabels}
                    keys={visibleCats}
                    colorOf={categoryColor}
                    grid={months.reduce((acc, m, i) => {
                      acc[monthLabels[i]] = visibleCats.reduce((o, c) => {
                        o[c] = filtered.filter((r) => r.month === m && r.category === c).reduce((a, r) => a + r.qty, 0);
                        return o;
                      }, {});
                      return acc;
                    }, {})}
                    onSegClick={(c, label) => {
                      const m = months[monthLabels.indexOf(label)];
                      openDetail({ eyebrow: '카테고리 상세', title: `${c} · ${m.slice(0, 4)}년 ${m.slice(5)}월`, color: categoryColor(c), rows: filtered.filter((r) => r.category === c && r.month === m), groupLabel: '충전재' });
                    }}
                  />
                )}
                <div className="legend">
                  {visibleCats.map((c) => (
                    <span className="legend-item" key={c}><span className="swatch" style={{ background: categoryColor(c) }} />{c}</span>
                  ))}
                </div>
              </>
            )}

            {tab === 'monthly' && (
              <>
                <div className="card-head">
                  <div>
                    <h2>월별 판매량 추이</h2>
                    <p>현재 필터 조건의 월별 판매수량 합계</p>
                  </div>
                </div>
                <BarChart
                  data={months.map((m, i) => ({
                    label: monthLabels[i],
                    value: filtered.filter((r) => r.month === m).reduce((a, r) => a + r.qty, 0),
                  }))}
                  emptyText="월을 선택해주세요"
                />
              </>
            )}

            {tab === 'top' && (
              <>
                <div className="card-head">
                  <div>
                    <h2>제품별 판매량 TOP 15</h2>
                    <p>현재 필터 조건의 상위 15개 제품 · 아래에서 카테고리를 골라 확인하세요</p>
                  </div>
                </div>
                <div className="chips">
                  {[
                    { key: 'all', label: '전체', color: '#4f46e5', cnt: filtered.reduce((a, r) => a + r.qty, 0) },
                    { key: 'main', label: '소파+바디필로우', color: '#0891b2', cnt: (catQty['소파'] || 0) + (catQty['바디필로우'] || 0) },
                    ...visibleCats.map((c) => ({ key: c, label: c, color: categoryColor(c), cnt: catQty[c] })),
                  ].map((ch) => (
                    <button key={ch.key} type="button" className={`chip ${topMode === ch.key ? 'chip-on' : ''}`} onClick={() => setTopMode(ch.key)}>
                      <span className="dot" style={{ background: ch.color }} />
                      {ch.label} <b>{ch.cnt.toLocaleString()}</b>
                    </button>
                  ))}
                </div>
                <RankBarChart
                  items={topProducts(filtered, topMode)}
                  emptyText="해당 카테고리의 데이터가 없습니다"
                />
              </>
            )}

            {tab === 'color' && (
              <>
                <div className="card-head">
                  <div>
                    <h2>인기 커버 색상 TOP</h2>
                    <p>가장 많이 판매된 커버 색상 순위 · 막대를 클릭하면 해당 색상 제품을 볼 수 있어요</p>
                  </div>
                  <div className="card-actions">
                    <Seg value={colorMode} onChange={setColorMode} options={[['all', '전체'], ['main', '소파+바디필로우']]} />
                  </div>
                </div>
                <RankBarChart
                  items={topColors(filtered, colorMode, isNonColor)}
                  nameWidth={240}
                  rowH={32}
                  gradient={false}
                  showSwatch
                  emptyIcon="🎨"
                  emptyText="색상 데이터가 없습니다"
                  onItemClick={(it) => {
                    let base = filtered.filter((r) => r.color === it.name);
                    if (colorMode === 'main') base = base.filter((r) => r.category === '소파' || r.category === '바디필로우');
                    openDetail({ eyebrow: '커버 색상 상세', title: it.name, color: it.color, rows: base, groupLabel: '카테고리' });
                  }}
                />
              </>
            )}

            {tab === 'weekday' && <WeekdayPanel rows={filtered} mode={weekdayMode} setMode={setWeekdayMode} />}

            {tab === 'kpi' && (
              <>
                <div className="kpi-mini-grid">
                  {KPI_LINES.map((line) => {
                    const vals = kpiSeries.map((s) => s[line.key]);
                    const now = vals[vals.length - 1] || 0;
                    const prev = vals.length >= 2 ? vals[vals.length - 2] : now;
                    const diff = now - prev;
                    const cls = diff > 0.01 ? 'up' : diff < -0.01 ? 'down' : 'flat';
                    const dText = line.key === 'aov' ? `${Math.abs(Math.round(diff)).toLocaleString()}원` : `${Math.abs(diff).toFixed(1)}p`;
                    return (
                      <div className="kpi-mini" key={line.key}>
                        <div className="kpi-mini-head">
                          <div className="kpi-mini-title"><span className="kpi-mini-dot" style={{ background: line.color }} />{line.label}</div>
                          <div>
                            <span className="kpi-mini-now">{line.fmt(now)}</span>
                            <span className={`kpi-mini-delta ${cls}`}>{diff > 0.01 ? '▲' : diff < -0.01 ? '▼' : '—'} {dText}</span>
                          </div>
                        </div>
                        <Sparkline values={vals} color={line.color} id={line.key} />
                      </div>
                    );
                  })}
                </div>

                <div className="card-head" style={{ marginTop: 18 }}>
                  <div>
                    <h2>통합 지표 월별 추이</h2>
                    <p>단일 지표를 고르면 막대로, 전체는 라인으로 겹쳐 비교</p>
                  </div>
                  <div className="card-actions">
                    <Seg value={kpiMetric} onChange={setKpiMetric} options={[['all', '전체'], ['setR', '세트율'], ['coverR', '커버율'], ['aov', '객단가'], ['cvr', 'CVR']]} />
                  </div>
                </div>

                {kpiMetric === 'all' ? (
                  <LineChart
                    xLabels={monthLabels}
                    normalizePerSeries
                    series={KPI_LINES.map((l) => ({ key: l.key, label: l.label, color: l.color, values: kpiSeries.map((s) => s[l.key]), fmt: l.fmt }))}
                    emptyText="월을 선택해주세요"
                  />
                ) : (
                  (() => {
                    const line = KPI_LINES.find((l) => l.key === kpiMetric);
                    return (
                      <BarChart
                        height={400}
                        data={kpiSeries.map((s, i) => ({ label: monthLabels[i], value: s[line.key], color: line.color }))}
                        yFormat={line.fmt}
                        valueFormat={line.fmt}
                        emptyText="월을 선택해주세요"
                      />
                    );
                  })()
                )}
                <div className="legend">
                  {(kpiMetric === 'all' ? KPI_LINES : KPI_LINES.filter((l) => l.key === kpiMetric)).map((l) => (
                    <span className="legend-item" key={l.key}><span className="swatch" style={{ background: l.color }} />{l.label}</span>
                  ))}
                </div>
              </>
            )}

            {tab === 'table' && (
              <>
                <div className="card-head">
                  <div>
                    <h2>제품별 상세 표</h2>
                    <p>필터 조건의 제품별 판매수량 · 매출 합계 (수량 기준 내림차순)</p>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="btn" onClick={downloadCSV} disabled={filtered.length === 0}>↓ CSV 내려받기</button>
                  </div>
                </div>
                <DetailTable rows={filtered} fillPalette={variant.fillPalette} />
              </>
            )}
          </div>
        </main>
      </section>

      <DetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

// ── 하위 컴포넌트 ──

function Kpi({ mark, label, value, sub, dark, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`kpi ${dark ? 'kpi-dark' : ''} ${onClick ? 'kpi-click' : ''}`} onClick={onClick}>
      <div className="kpi-label"><span className="kpi-icon">{mark}</span>{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}{onClick ? ' ›' : ''}</div>
    </Tag>
  );
}

function FilterSection({ title, count, onAll, onNone, children }) {
  return (
    <div className="filter-section">
      <div className="filter-section-head">
        <div className="filter-title">{title} <span className="count">{count}</span></div>
        <div className="filter-mini">
          <button type="button" onClick={onAll}>전체</button>
          <button type="button" onClick={onNone}>해제</button>
        </div>
      </div>
      <div className="filter-body">{children}</div>
    </div>
  );
}

function ChipGroup({ items, active, onToggle }) {
  if (!items.length) return <span className="chip chip-static">결과 없음</span>;
  return (
    <div className="chips chips-wrap">
      {items.map((it) => (
        <button key={it} type="button" className={`chip ${active.has(it) ? 'chip-on' : ''}`} onClick={() => onToggle(it)}>
          {it}
        </button>
      ))}
    </div>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([k, label]) => (
        <button key={k} type="button" className={value === k ? 'active' : ''} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

function StoreCompareTable({ stats }) {
  if (!stats.length) return <div className="chart-empty"><div className="chart-empty-ic">🏬</div>비교할 매장 데이터가 없습니다</div>;

  const tot = stats.reduce(
    (a, s) => ({
      totalAmount: a.totalAmount + s.totalAmount, totalQty: a.totalQty + s.totalQty,
      sofaQty: a.sofaQty + s.sofaQty, bpQty: a.bpQty + s.bpQty, oc: a.oc + s.oc,
      setCount: a.setCount + s.setCount, coverCount: a.coverCount + s.coverCount, visits: a.visits + s.visits,
    }),
    { totalAmount: 0, totalQty: 0, sofaQty: 0, bpQty: 0, oc: 0, setCount: 0, coverCount: 0, visits: 0 },
  );
  const maxAmount = Math.max(1, ...stats.map((s) => s.totalAmount));
  const medals = ['#fbbf24', '#cbd5e1', '#d6a06a'];

  return (
    <div className="table-wrap" style={{ maxHeight: 560 }}>
      <table className="table">
        <thead>
          <tr>
            <th>매장</th><th className="right">매출</th><th className="right">구매건수</th>
            <th className="right">소파</th><th className="right">바디필로우</th>
            <th className="right">세트율</th><th className="right">커버율</th>
            <th className="right">객단가</th><th className="right">CVR</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.store}>
              <td>
                <span className="rank-badge" style={i < 3 ? { background: medals[i], color: '#111' } : undefined}>{i + 1}</span>
                <strong>{s.store}</strong>
              </td>
              <td className="right">
                <div>{formatAmount(s.totalAmount)}</div>
                <div className="minibar"><div style={{ width: `${(s.totalAmount / maxAmount) * 100}%` }} /></div>
              </td>
              <td className="right">{s.oc.toLocaleString()}건</td>
              <td className="right">{s.sofaQty.toLocaleString()}<span className="dim-inline"> ({s.sofaRate.toFixed(0)}%)</span></td>
              <td className="right">{s.bpQty.toLocaleString()}<span className="dim-inline"> ({s.bpRate.toFixed(0)}%)</span></td>
              <td className="right">{s.setRate.toFixed(1)}%</td>
              <td className="right">{s.coverRate.toFixed(1)}%</td>
              <td className="right"><strong>{s.aov.toLocaleString()}원</strong></td>
              <td className="right">{s.cvr > 0 ? s.cvr.toFixed(1) + '%' : '—'}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td><strong>합계 · {stats.length}개 매장</strong></td>
            <td className="right"><strong>{formatAmount(tot.totalAmount)}</strong></td>
            <td className="right">{tot.oc.toLocaleString()}건</td>
            <td className="right">{tot.sofaQty.toLocaleString()}</td>
            <td className="right">{tot.bpQty.toLocaleString()}</td>
            <td className="right">{tot.oc > 0 ? ((tot.setCount / tot.oc) * 100).toFixed(1) : 0}%</td>
            <td className="right">{tot.oc > 0 ? ((tot.coverCount / tot.oc) * 100).toFixed(1) : 0}%</td>
            <td className="right"><strong>{(tot.oc > 0 ? Math.round(tot.totalAmount / tot.oc) : 0).toLocaleString()}원</strong></td>
            <td className="right">{tot.visits > 0 ? ((tot.oc / tot.visits) * 100).toFixed(1) + '%' : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function WeekdayPanel({ rows, mode, setMode }) {
  const buckets = WEEKDAYS.map(() => ({ qty: 0, amount: 0, orders: new Set() }));
  let any = false;
  for (const r of rows) {
    const s = String(r.date || '').slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) continue;
    any = true;
    const wd = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
    buckets[wd].qty += r.qty;
    buckets[wd].amount += r.amount;
    if (r.orderNo) buckets[wd].orders.add(r.orderNo);
  }

  const valOf = (b) => (mode === 'amount' ? b.amount : mode === 'oc' ? b.orders.size : b.qty);
  const vals = buckets.map(valOf);
  const unit = mode === 'amount' ? '' : mode === 'oc' ? '건' : '개';
  const fmt = (v) => (mode === 'amount' ? formatAmount(v) : v.toLocaleString() + unit);
  const total = vals.reduce((a, b) => a + b, 0);
  const bestIdx = vals.indexOf(Math.max(...vals));
  const weekendVal = vals[0] + vals[6];

  return (
    <>
      <div className="card-head">
        <div>
          <h2>요일별 판매 패턴</h2>
          <p>요일별 판매수량·건수 분포 · 인력·프로모션 배치에 활용</p>
        </div>
        <div className="card-actions">
          <Seg value={mode} onChange={setMode} options={[['qty', '판매수량'], ['amount', '매출'], ['oc', '구매건수']]} />
        </div>
      </div>
      {!any ? (
        <div className="chart-empty"><div className="chart-empty-ic">📅</div>날짜 데이터가 없습니다</div>
      ) : (
        <>
          <BarChart
            height={320}
            data={vals.map((v, i) => ({
              label: WEEKDAYS[i],
              value: v,
              color: i === 0 || i === 6 ? '#f43f5e' : '#4f46e5',
              emphasis: i === 0 || i === 6,
              labelColor: i === 0 || i === 6 ? '#f43f5e' : undefined,
            }))}
            yFormat={(v) => (mode === 'amount' ? `${Math.round(v / 10000)}만` : Math.round(v).toLocaleString())}
            valueFormat={fmt}
          />
          <div className="insight-row">
            <div className="insight">
              <div className="insight-label">최고 요일</div>
              <div className="insight-value">{WEEKDAYS[bestIdx]}요일</div>
              <div className="insight-sub">{fmt(vals[bestIdx])} · 전체의 {total > 0 ? ((vals[bestIdx] / total) * 100).toFixed(0) : 0}%</div>
            </div>
            <div className="insight">
              <div className="insight-label">주말(토·일)</div>
              <div className="insight-value">{total > 0 ? ((weekendVal / total) * 100).toFixed(0) : 0}%</div>
              <div className="insight-sub">{fmt(weekendVal)}</div>
            </div>
            <div className="insight">
              <div className="insight-label">주중(월~금)</div>
              <div className="insight-value">{total > 0 ? (((total - weekendVal) / total) * 100).toFixed(0) : 0}%</div>
              <div className="insight-sub">{fmt(total - weekendVal)}</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function DetailTable({ rows, fillPalette }) {
  if (!rows.length) return <div className="chart-empty"><div className="chart-empty-ic">📋</div>데이터가 없습니다</div>;
  const agg = {};
  for (const r of rows) {
    const k = `${r.productName}|${r.fill}|${r.category}`;
    if (!agg[k]) agg[k] = { name: r.productName, category: r.category, fill: r.fill, qty: 0, amount: 0 };
    agg[k].qty += r.qty;
    agg[k].amount += r.amount;
  }
  const list = Object.values(agg).sort((a, b) => b.qty - a.qty);
  const maxQty = Math.max(1, ...list.map((r) => r.qty));

  return (
    <div className="table-wrap" style={{ maxHeight: 620 }}>
      <table className="table">
        <thead>
          <tr><th>제품명</th><th>카테고리</th><th>충전재</th><th className="right">판매수량</th><th className="right">매출액</th><th style={{ width: 120 }}>비중</th></tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={`${r.name}|${r.fill}|${r.category}`}>
              <td className="strong">{r.name}</td>
              <td><span className="pill" style={{ color: categoryColor(r.category), borderColor: `${categoryColor(r.category)}55` }}>{r.category}</span></td>
              <td><span className="spec"><i className="swatch-dot" style={{ background: fillPalette[r.fill] || '#94a3b8' }} />{r.fill}</span></td>
              <td className="right mono">{r.qty.toLocaleString()}</td>
              <td className="right mono">{Math.round(r.amount).toLocaleString()}원</td>
              <td><div className="minibar"><div style={{ width: `${(r.qty / maxQty) * 100}%` }} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 집계 헬퍼 ──

function topProducts(rows, mode) {
  let target = rows;
  if (mode === 'main') target = rows.filter((r) => r.category === '소파' || r.category === '바디필로우');
  else if (mode !== 'all') target = rows.filter((r) => r.category === mode);
  const agg = {};
  for (const r of target) agg[r.productName] = (agg[r.productName] || 0) + r.qty;
  return Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, value]) => ({ name, value }));
}

function topColors(rows, mode, isNonColor) {
  let target = rows.filter((r) => !isNonColor(r.color));
  if (mode === 'main') target = target.filter((r) => r.category === '소파' || r.category === '바디필로우');
  const agg = {};
  for (const r of target) agg[r.color] = (agg[r.color] || 0) + r.qty;
  const total = target.reduce((a, r) => a + r.qty, 0);
  return Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, value]) => ({ name, value, color: colorSwatch(name), share: total > 0 ? (value / total) * 100 : 0 }));
}
