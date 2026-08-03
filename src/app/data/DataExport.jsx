'use client';

import { useEffect, useMemo, useState } from 'react';
import { rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { DATASETS, download, rowsOf, toCsv } from '@/lib/exportSets';
import { monthRange } from '@/hooks/useYLeague';

const MCP_TOOLS = [
  ['offline_sales', '오프라인 매장 매출 분석'],
  ['y_league', 'Y리그 좌수왕·캐스트·스토어'],
  ['online_offline_compare', '온·오프라인 비교'],
  ['cafe24_analysis', '자사몰 매출·상품·색상'],
  ['smartstore_analysis', '스마트스토어 상품·유입'],
  ['promotion_performance', '전 몰 프로모션 성과'],
  ['daily_briefing', '일일 브리핑'],
  ['delivery_status', '출고·배송 현황'],
  ['staff_schedule', '근무 일정'],
];

const MCP_URL = 'https://port-0-yogibo-onmcp-lzgmwhc4d9883c97.sel4.cloudtype.app/mcp';

/** 원격(HTTP) — 서버가 이미 떠 있어 각자 설정만 넣으면 된다 */
const CONFIG_REMOTE = `{
  "mcpServers": {
    "yogibo-sales": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer <MCP_TOKEN>" }
    }
  }
}`;

/** 로컬(stdio) — 본인 PC에 onlineData 저장소가 있을 때 */
const CONFIG_LOCAL = `{
  "mcpServers": {
    "yogibo-sales": {
      "command": "node",
      "args": ["C:\\Users\\<사용자>\\Desktop\\onlineData\\mcp\\server.js"]
    }
  }
}`;

export default function DataExport() {
  const [id, setId] = useState(DATASETS[0].id);
  const [store, setStore] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const months = useAsync(async () => {
    const json = await rtGet('api/months');
    return [...(json?.months || [])].sort().reverse();
  }, []);

  const stores = useAsync(async () => {
    const json = await rtGet('api/store-tokens');
    return Object.keys(json?.tokens || {}).sort((a, b) => a.localeCompare(b, 'ko'));
  }, []);

  const [range, setRange] = useState({ start: '', end: '' });
  useEffect(() => {
    const latest = months.data?.[0];
    if (latest && !range.start) {
      const { startDate, endDate } = monthRange(latest);
      setRange({ start: startDate, end: endDate });
    }
  }, [months.data, range.start]);

  useEffect(() => {
    if (!store && stores.data?.length) setStore(stores.data[0]);
  }, [stores.data, store]);

  const set = useMemo(() => DATASETS.find((d) => d.id === id), [id]);

  async function fetchRows() {
    const { start, end } = range;
    if (id === 'offline-sales') {
      // 월 단위 API라 기간에 걸친 월을 모두 받아 합친 뒤 일자로 다시 자른다
      const list = (months.data || []).filter((m) => m >= start.slice(0, 7) && m <= end.slice(0, 7));
      const all = [];
      for (const m of list) {
        const json = await rtGet('api/orders', { month: m, store: 'all' }).catch(() => null);
        for (const o of rowsOf(id, json)) {
          const d = String(o.date || '').slice(0, 10);
          if (!d || (d >= start && d <= end)) all.push(o);
        }
      }
      return all;
    }
    if (id === 'jwasu') return rowsOf(id, await rtGet('api/jwasu/dashboard', { searchType: 'range', date: end, startDate: start, endDate: end }));
    if (id === 'jwasu-daily') return rowsOf(id, await rtGet('api/jwasu/table', { startDate: start, endDate: end }));
    if (id === 'stock-center') return rowsOf(id, await rtGet('api/stock/전체'));
    if (id === 'stock-store') return rowsOf(id, await rtGet('api/warehouse-stock', { store }));
    return [];
  }

  async function run(format) {
    setBusy(true);
    setResult(null);
    try {
      const rows = await fetchRows();
      if (!rows.length) {
        setResult({ ok: false, msg: '해당 조건에 데이터가 없습니다.' });
        return;
      }
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      const stamp = set.period ? `${range.start}_${range.end}` : id === 'stock-store' ? `${store}_${today}` : today;
      const base = `${set.name}_${stamp}`.replace(/\s+/g, '');
      if (format === 'csv') download(`${base}.csv`, toCsv(rows, set.columns), 'text/csv');
      else download(`${base}.json`, JSON.stringify(rows, null, 2), 'application/json');
      setResult({ ok: true, msg: `${rows.length.toLocaleString()}행 내려받았습니다.` });
    } catch (e) {
      setResult({ ok: false, msg: e.message || '내려받기에 실패했습니다.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h2>데이터 내려받기</h2>
            <p>화면이 쓰는 원장을 그대로 CSV·JSON으로 받습니다. 고객 개인정보는 포함하지 않습니다.</p>
          </div>
        </div>

        <div className="chips">
          {DATASETS.map((d) => (
            <button key={d.id} type="button" className={`chip ${id === d.id ? 'chip-on' : ''}`} onClick={() => { setId(d.id); setResult(null); }}>
              {d.name}
            </button>
          ))}
        </div>

        <p className="summary">{set.desc} · <code>{set.source}</code></p>

        <div className="toolbar">
          {set.period && (
            <>
              <input type="date" className="input" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
              <span className="period-dash">~</span>
              <input type="date" className="input" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
            </>
          )}
          {set.needsStore && (
            <select className="input select" value={store} onChange={(e) => setStore(e.target.value)}>
              {(stores.data || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-download" onClick={() => run('csv')} disabled={busy}>
            {busy ? '준비 중…' : '↓ CSV'}
          </button>
          <button type="button" className="btn" onClick={() => run('json')} disabled={busy}>↓ JSON</button>
        </div>

        {result && <div className={result.ok ? 'snap-count' : 'warn-banner'}>{result.msg}</div>}

        <p className="footnote" style={{ marginTop: 12 }}>
          포함 컬럼: <code>{set.columns.join(', ')}</code>
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>채팅으로 확인하기 (MCP)</h2>
            <p>Claude에 데이터를 연결하면 화면을 열지 않고 대화로 물어볼 수 있습니다.</p>
          </div>
        </div>

        <p className="summary">
          <b>onlineData</b>의 MCP 서버가 온라인·오프라인 데이터를 함께 노출합니다.
          이미 배포돼 있으니 Claude Desktop 설정에 아래를 넣고 재시작하면 됩니다.
        </p>

        <p className="summary" style={{ marginTop: 12 }}>
          <b>① 원격 (권장)</b> — 서버가 떠 있어 설정만 넣으면 됩니다. <code>MCP_TOKEN</code> 은 담당자에게 받으세요.
        </p>
        <pre className="code-block">{CONFIG_REMOTE}</pre>

        <p className="summary" style={{ marginTop: 12 }}>
          <b>② 로컬</b> — 본인 PC에 <code>onlineData</code> 저장소와 <code>.env</code> 가 있을 때.
        </p>
        <pre className="code-block">{CONFIG_LOCAL}</pre>

        <p className="summary" style={{ marginTop: 14 }}>쓸 수 있는 도구 (일부)</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>도구</th><th>내용</th></tr></thead>
            <tbody>
              {MCP_TOOLS.map(([t, d]) => (
                <tr key={t}><td className="mono strong">{t}</td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="footnote">
          집계·성과만 노출하고 고객 이름·연락처는 제공하지 않습니다.
서버 상태는 <code>/health</code> 로 확인할 수 있습니다.
          <code>app.cloudtype.io/@…</code> 주소는 배포 <b>콘솔</b>이라 Claude가 붙을 수 없습니다 — 위 <code>/mcp</code> 주소를 쓰세요.
          자세한 절차는 <code>onlineData/mcp/README.md</code> 에 있습니다.
        </p>
      </section>
    </>
  );
}
