'use client';

import { useEffect, useMemo, useState } from 'react';
import DataState from '@/components/DataState';
import { offGet, offUrl, rtGet, rtUrl } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { colorOf } from '@/lib/colors';
import {
  CATEGORY_TONE, TABS, applySubFilter, applyTabFilter, cleanRows, countedNames,
  fetchCategoryOf, searchRows, sortRows, stockState, subGroupsOf,
} from '@/lib/stock/center';

const SORTS = { name: '상품명', qty: '재고수량' };

export default function StockCenter() {
  const [tab, setTab] = useState('전체');
  const [sub, setSub] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ column: 'qty', asc: false });
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const lastUpdate = useAsync(() => rtGet('api/system/last-update'), []);
  const stock = useAsync(() => rtGet(`api/stock/${encodeURIComponent(fetchCategoryOf(tab))}`), [tab]);

  // 탭이 바뀌면 하위 선택은 초기화
  useEffect(() => {
    setSub(null);
    setDetail(null);
    setQuery('');
  }, [tab]);

  const all = useMemo(() => applyTabFilter(cleanRows(stock.data), tab), [stock.data, tab]);
  const subGroups = useMemo(() => subGroupsOf(tab, all), [tab, all]);
  const subFiltered = useMemo(() => applySubFilter(all, tab, sub), [all, tab, sub]);

  // 커버 탭만 2단계 — 그룹을 고르면 그 안의 상품명 버튼이 뜬다
  const detailNames = useMemo(
    () => (tab === '커버' && sub ? countedNames(subFiltered) : []),
    [tab, sub, subFiltered],
  );
  const detailFiltered = useMemo(
    () => (detail ? subFiltered.filter((i) => i.name === detail) : subFiltered),
    [subFiltered, detail],
  );

  const rows = useMemo(
    () => sortRows(searchRows(detailFiltered, query), sort.column, sort.asc),
    [detailFiltered, query, sort],
  );

  const countText = useMemo(() => {
    const base = `총 ${rows.length.toLocaleString()}건`;
    if (tab === '안전재고') return `${base} (4~10개)`;
    if (tab === '재고소진') return `${base} (0~3개)`;
    return base;
  }, [rows.length, tab]);

  const updatedAt = useMemo(() => {
    const ts = lastUpdate.data?.timestamp;
    if (!ts) return null;
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('ko-KR', { hour12: false });
  }, [lastUpdate.data]);

  function toggleSort(column) {
    setSort((s) => (s.column === column ? { column, asc: !s.asc } : { column, asc: column !== 'qty' }));
  }

  return (
    <>
      <div className="toolbar">
        <div className="chips" style={{ marginBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`chip ${tab === t.key ? 'chip-on' : ''} ${t.tone ? `chip-${t.tone}` : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="품목코드, 상품명, 색상 검색…"
          disabled={stock.loading}
        />

        {updatedAt && <span className="badge">업데이트 {updatedAt}</span>}

        <div className="actions" style={{ marginLeft: 'auto' }}>
          <a className="btn" href={rtUrl('api/download/stock')}>↓ 전체 엑셀</a>
          <button type="button" className="btn" onClick={() => setSnapshotOpen(true)}>📅 일자별 스냅샷</button>
        </div>
      </div>

      {subGroups.length > 0 && (
        <div className="chips">
          <button type="button" className={`chip ${sub === null ? 'chip-on' : ''}`} onClick={() => { setSub(null); setDetail(null); }}>
            전체 보기
          </button>
          {subGroups.map((g) => (
            <button
              key={g}
              type="button"
              className={`chip ${sub === g ? 'chip-on' : ''}`}
              onClick={() => { setSub(g); setDetail(null); }}
            >
              {g.replace(' 커버', '').replace(' 이너', '')}
            </button>
          ))}
        </div>
      )}

      {detailNames.length > 0 && (
        <div className="chips chips-detail">
          <button type="button" className={`chip chip-sm ${detail === null ? 'chip-on' : ''}`} onClick={() => setDetail(null)}>전체</button>
          {detailNames.map((n) => (
            <button key={n} type="button" className={`chip chip-sm ${detail === n ? 'chip-on' : ''}`} onClick={() => setDetail(n)}>
              {n.replace(' 커버', '')}
            </button>
          ))}
        </div>
      )}

      <DataState
        loading={stock.loading}
        error={stock.error}
        empty={!stock.loading && !stock.error && rows.length === 0}
        emptyText={all.length === 0 ? '해당 분류의 재고가 없습니다.' : '검색 결과가 없습니다.'}
        onRetry={stock.reload}
      />

      {!stock.loading && !stock.error && rows.length > 0 && (
        <>
          <p className="summary">{countText}</p>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th className="col-narrow center">분류</th>
                  <th className="col-narrow center">품목코드</th>
                  <th className={`sortable ${sort.column === 'name' ? 'sort-on' : ''}`} onClick={() => toggleSort('name')}>
                    {SORTS.name} <span className="sort-icon">{sort.column === 'name' && sort.asc ? '▲' : '▼'}</span>
                  </th>
                  <th>색상 / 옵션</th>
                  <th className={`sortable right ${sort.column === 'qty' ? 'sort-on' : ''}`} onClick={() => toggleSort('qty')}>
                    {SORTS.qty} <span className="sort-icon">{sort.column === 'qty' && sort.asc ? '▲' : '▼'}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => <Row key={`${item.code}-${item.spec}-${item.name}`} item={item} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {snapshotOpen && <SnapshotModal onClose={() => setSnapshotOpen(false)} />}
    </>
  );
}

function Row({ item }) {
  const state = stockState(item.qty);
  const hex = colorOf(item.spec);
  const tone = CATEGORY_TONE[item.category];

  return (
    <tr className={state === 'out' ? 'row-out' : ''}>
      <td className="center">
        <span className={`pill ${tone ? `pill-${tone}` : ''}`}>{item.category}</span>
      </td>
      <td className="center mono dim">{item.code || '-'}</td>
      <td className="strong">{item.name}</td>
      <td>
        <span className="spec">
          {hex && <i className="swatch" style={{ backgroundColor: hex }} />}
          <span>{item.spec}</span>
          {state === 'critical' && <span className="pill pill-warn">소진임박</span>}
          {state === 'safety' && <span className="pill pill-safety">안전재고</span>}
          {state === 'out' && <span className="pill">품절</span>}
        </span>
      </td>
      <td className="right mono">
        <span className={`qty qty-${state}`}>{item.qty}</span>
      </td>
    </tr>
  );
}

/** 일자별 재고 스냅샷 — 기간 내 각 일자의 엑셀을 순차 다운로드 (원본 동작) */
function SnapshotModal({ onClose }) {
  const dates = useAsync(async () => {
    const json = await offGet('api/stock/snapshot/dates');
    return (json?.dates || []).map((d) => d.snapshot_date).sort();
  }, []);

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(0);

  useEffect(() => {
    const list = dates.data;
    if (list?.length) {
      setStart(list[0]);
      setEnd(list[list.length - 1]);
    }
  }, [dates.data]);

  const targets = useMemo(
    () => (dates.data || []).filter((d) => start && end && d >= start && d <= end),
    [dates.data, start, end],
  );
  const invalid = start && end && start > end;

  async function download() {
    if (!targets.length) return;
    if (targets.length > 31 && !window.confirm(`${targets.length}개 파일을 다운로드합니다. 계속할까요?`)) return;
    for (let i = 0; i < targets.length; i++) {
      setBusy(i + 1);
      const a = document.createElement('a');
      a.href = offUrl('api/stock/snapshot/download', { date: targets[i] });
      a.download = `재고스냅샷_${targets[i]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 600)); // 브라우저가 연속 다운로드를 막지 않도록 간격
    }
    setBusy(0);
    onClose();
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">물류센터 재고</div>
            <h3>일자별 스냅샷 다운로드</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 18 }}>
          <DataState loading={dates.loading} error={dates.error} onRetry={dates.reload} />

          {!dates.loading && !dates.error && (
            (dates.data || []).length === 0 ? (
              <p className="small">저장된 일자가 없습니다.</p>
            ) : (
              <>
                <div className="toolbar">
                  <select className="input select" value={start} onChange={(e) => setStart(e.target.value)}>
                    {dates.data.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span className="period-dash">~</span>
                  <select className="input select" value={end} onChange={(e) => setEnd(e.target.value)}>
                    {dates.data.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className={invalid ? 'warn-banner' : 'snap-count'}>
                  {invalid ? '시작일이 종료일보다 늦습니다' : `${start} ~ ${end} · 총 ${targets.length}개 파일 다운로드`}
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={download}
                  disabled={invalid || !targets.length || busy > 0}
                >
                  {busy > 0 ? `다운로드 중… ${busy}/${targets.length}` : '엑셀 내려받기'}
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
