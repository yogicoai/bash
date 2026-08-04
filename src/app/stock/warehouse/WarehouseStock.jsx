'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { colorOf, displayGroup } from '@/lib/colors';
import DataState from '@/components/DataState';

const SORTS = {
  name: { label: '상품명', numeric: false },
  storeQty: { label: '매장재고', numeric: true },
  demoQty: { label: '데모(전시)', numeric: true },
};

export default function WarehouseStock({ initialStore }) {
  const router = useRouter();
  const params = useSearchParams();
  const [store, setStore] = useState(initialStore || '');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(null);
  const [sort, setSort] = useState({ column: 'storeQty', asc: false });

  // 매장 목록 — store_tokens의 키가 warehouse-stock API가 받는 매장명이다.
  const stores = useAsync(async () => {
    const json = await rtGet('api/store-tokens');
    return Object.keys(json.tokens || {}).sort((a, b) => a.localeCompare(b, 'ko'));
  }, []);

  const stock = useAsync(() => rtGet('api/warehouse-stock', { store }), [store], { skip: !store });

  // 매장(판매) 또는 데모(전시) 재고가 하나라도 있는 품목만 — 원본 동작 유지
  const items = useMemo(
    () => (stock.data?.items || []).filter((i) => i.storeQty > 0 || i.demoQty > 0),
    [stock.data],
  );

  const groupCounts = useMemo(() => {
    const map = new Map();
    for (const i of items) map.set(i.group, (map.get(i.group) || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const rows = useMemo(() => {
    const base = group ? items.filter((i) => i.group === group) : items;

    const keywords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const filtered = keywords.length
      ? base.filter((i) => {
          const target = `${i.code} ${i.name} ${i.spec} ${i.group}`.toLowerCase();
          return keywords.every((k) => target.includes(k));
        })
      : base;

    const { column, asc } = sort;
    return [...filtered].sort((a, b) => {
      if (SORTS[column].numeric) return asc ? a[column] - b[column] : b[column] - a[column];
      const x = String(a[column] ?? '').toLowerCase();
      const y = String(b[column] ?? '').toLowerCase();
      return asc ? x.localeCompare(y, 'ko') : y.localeCompare(x, 'ko');
    });
  }, [items, group, query, sort]);

  const totals = useMemo(
    () => ({
      store: rows.reduce((s, i) => s + Math.max(i.storeQty, 0), 0),
      demo: rows.reduce((s, i) => s + Math.max(i.demoQty, 0), 0),
    }),
    [rows],
  );

  function pickStore(next) {
    setStore(next);
    setGroup(null);
    setQuery('');
    // 링크 공유가 되도록 URL에도 반영 (기존 ?store= 링크와 호환)
    // 기존 쿼리를 갈아엎지 않는다 — 팝업으로 열렸을 때 붙는 bare=1 이 날아가면
    // 팝업 안에 사이드바가 다시 그려진다.
    const q = new URLSearchParams(params?.toString() || '');
    if (next) q.set('store', next);
    else q.delete('store');
    const qs = q.toString();
    router.replace(qs ? `/stock/warehouse?${qs}` : '/stock/warehouse');
  }

  function toggleSort(column) {
    setSort((s) =>
      s.column === column ? { column, asc: !s.asc } : { column, asc: column === 'name' },
    );
  }

  return (
    <>
      <div className="toolbar">
        <select
          className="input select"
          value={store}
          onChange={(e) => pickStore(e.target.value)}
          disabled={stores.loading}
        >
          <option value="">
            {stores.loading ? '매장 불러오는 중…' : '매장을 선택하세요'}
          </option>
          {(stores.data || []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="품목코드, 상품명, 색상 검색…"
          disabled={!store || stock.loading}
        />

        {stock.data?.snapshotDate && (
          <span className="badge">기준일 {stock.data.snapshotDate}</span>
        )}
      </div>

      {!store ? (
        <div className="state">
          <p className="state-title">매장을 선택하면 창고 재고를 보여줍니다.</p>
        </div>
      ) : (
        <>
          {!stock.loading && !stock.error && groupCounts.length > 0 && (
            <div className="chips">
              <button
                type="button"
                className={`chip ${group === null ? 'chip-on' : ''}`}
                onClick={() => setGroup(null)}
              >
                전체 보기
              </button>
              {groupCounts.map(([g, count]) => (
                <button
                  key={g}
                  type="button"
                  className={`chip ${group === g ? 'chip-on' : ''}`}
                  onClick={() => setGroup(g)}
                >
                  {displayGroup(g)} ({count})
                </button>
              ))}
            </div>
          )}

          <DataState
            loading={stock.loading}
            error={stock.error}
            empty={!stock.loading && !stock.error && rows.length === 0}
            emptyText={items.length === 0 ? '재고가 있는 품목이 없습니다.' : '검색 결과가 없습니다.'}
            onRetry={stock.reload}
          />

          {!stock.loading && !stock.error && rows.length > 0 && (
            <>
              <p className="summary">
                총 <b>{rows.length.toLocaleString()}</b>개 품목 · 매장재고{' '}
                <b>{totals.store.toLocaleString()}</b>개 · 데모 <b>{totals.demo.toLocaleString()}</b>개
              </p>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="col-narrow center">분류</th>
                      <th className="col-narrow center">품목코드</th>
                      <SortableTh column="name" sort={sort} onSort={toggleSort} />
                      <th>색상 / 옵션</th>
                      <SortableTh column="storeQty" sort={sort} onSort={toggleSort} align="right" />
                      <SortableTh column="demoQty" sort={sort} onSort={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <Row key={`${item.code}-${item.spec}`} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function SortableTh({ column, sort, onSort, align = 'left' }) {
  const active = sort.column === column;
  return (
    <th
      className={`sortable ${align === 'right' ? 'right' : ''} ${active ? 'sort-on' : ''}`}
      onClick={() => onSort(column)}
    >
      {SORTS[column].label} <span className="sort-icon">{active && sort.asc ? '▲' : '▼'}</span>
    </th>
  );
}

function Qty({ value, warn = true }) {
  if (!value || value <= 0) return <span className="qty-none">-</span>;
  return <span className={warn && value <= 2 ? 'qty-low' : 'qty'}>{value.toLocaleString()}</span>;
}

function Row({ item }) {
  const hex = colorOf(item.spec);
  return (
    <tr>
      <td className="center">
        <span className="pill">{displayGroup(item.group)}</span>
      </td>
      <td className="center mono dim">{item.code || '-'}</td>
      <td className="strong">{item.name || '-'}</td>
      <td>
        <span className="spec">
          {hex && <i className="swatch" style={{ backgroundColor: hex }} />}
          <span>{item.spec || '-'}</span>
          {item.storeQty > 0 && item.storeQty <= 2 && <span className="pill pill-warn">소진임박</span>}
        </span>
      </td>
      <td className="right mono">
        <Qty value={item.storeQty} />
      </td>
      <td className="right mono">
        <Qty value={item.demoQty} warn={false} />
      </td>
    </tr>
  );
}
