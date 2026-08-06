'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { onGet, rtGet } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';

/**
 * 이번 달 목표 달성률 — 오프라인 / 온라인 두 줄.
 *
 * ⚠ 갱신 시점이 위쪽 실시간 매출과 다르다.
 *   이카운트가 매일 오전 10시에 올라가므로 실적은 "어제까지"다.
 *   따라서 기준선(경과율)도 어제까지로 계산해야 한다 — 오늘을 포함하면
 *   아직 오지 않은 하루가 분모에 들어가 실제보다 뒤처져 보인다.
 *   같은 화면에 실시간 숫자와 나란히 놓이므로 라벨로도 구분한다.
 *
 * 실적
 *   오프라인 = realtime /api/orders 합계 (제외 없이 전액 — 오프라인 매출 시스템의
 *              "전체 매장 합계"와 같은 값이어야 비교가 되므로)
 *   온라인   = 자사몰 + 스마트스토어(compare/period) + 외부몰(other/overview)
 *              조회 구간을 어제까지로 끊는다 — 온라인 일일매출 리포트와 같은 값이 되도록.
 *
 * 목표
 *   기본값은 API에서 읽고(오프라인은 매장 목표 합, 온라인은 채널 목표 합),
 *   직접 입력하면 그 값이 우선한다.
 *   입력값은 서버(onlineData Mongo)에 저장해 누가 보든 같은 값이 되게 한다.
 */
const KEY = 'dash.monthlyTargets';

/** 더 자세히 볼 곳 — 각자 원래 쓰던 화면으로 보낸다 */
const MORE = {
  offline: { href: 'https://yogibo.kr/off/index.html', label: '오프라인 매출 시스템에서 보기' },
  online: { href: 'https://on-iota-three.vercel.app/', label: '온라인 판매분석에서 보기' },
};
const fmt = (n) => Math.round(n || 0).toLocaleString();
const eok = (n) => {
  const v = Math.round((n || 0) / 10000);
  return v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${fmt(v)}만`;
};
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export default function TargetProgress() {
  const today = todayKST();
  const month = today.slice(0, 7);
  const [custom, setCustom] = useState({});
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null);
  const detailRef = useRef(null);
  const [draft, setDraft] = useState({ offline: '', online: '' });

  /**
   * 입력한 목표는 서버에 둔다 — 예전에는 브라우저에만 남아 사람마다 다른 값을 봤다.
   * 서버에 없고 이 브라우저에만 남아 있으면 한 번 옮겨준다.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      let saved = null;
      try {
        const j = await fetch(`/api/targets?month=${month}`, { cache: 'no-store' }).then((r) => r.json());
        if (j?.success && j.targets) saved = j.targets;
      } catch {
        /* 저장소가 막히면 아래 로컬값이나 원천 기본값으로 */
      }
      if (!alive) return;

      if (saved) {
        setCustom({ offline: saved.offline || 0, online: saved.online || 0 });
        return;
      }
      let local = null;
      try {
        local = JSON.parse(localStorage.getItem(KEY) || '{}')[month] || null;
      } catch {
        /* 무시 */
      }
      if (local && (local.offline || local.online)) {
        setCustom(local);
        // 예전에 이 브라우저에만 넣어둔 값을 서버로 올린다
        fetch('/api/targets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ month, ...local }),
        }).catch(() => {});
      } else {
        setCustom({});
      }
    })();
    return () => { alive = false; };
  }, [month]);

  // 어제까지 데이터를 다시 읽기 — 이카운트 반영이 늦거나 수집이 밀렸을 때
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);

  async function resync() {
    if (syncing) return;
    setSyncing(true);
    try {
      // 수집을 한 번 돌리고(서버 잠금이 알아서 걸러 준다) 잠시 뒤 다시 읽는다
      await fetch('/api/auto-sync', { cache: 'no-store' }).catch(() => {});
      await new Promise((r) => setTimeout(r, 12_000));
    } finally {
      setTick((t) => t + 1);
      setSyncing(false);
    }
  }

  const data = useAsync(async () => {
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const start = `${month}-01`;

    // 실적은 오늘 오전 10시에 올라온 "어제까지" 값이다.
    // 조회 구간도 어제로 끊어야 온라인 일일매출 리포트와 같은 숫자가 된다 —
    // 월말까지 열어두면 cafe24·스마트스토어 실시간 API가 오늘치까지 얹어
    // 리포트보다 크게 나오고, 경과일(어제까지)과도 기준이 어긋난다.
    const y = new Date(`${today}T00:00:00+09:00`);
    y.setDate(y.getDate() - 1);
    const asOf = y.toLocaleDateString('sv-SE');
    const inMonth = asOf.slice(0, 7) === month;
    const end = inMonth ? asOf : `${month}-${lastDay}`;

    const [dash, orders, target, period, other, onDaily] = await Promise.all([
      rtGet('api/jwasu/dashboard', { searchType: 'month', month, date: end, startDate: start, endDate: end }).catch(() => null),
      rtGet('api/orders', { month, store: 'all' }).catch(() => null),
      onGet('api/target', { month }).catch(() => null),
      onGet('api/compare/period', { start, end }).catch(() => null),
      onGet('api/other/overview', { start, end }).catch(() => null),
      // 온라인 일자별 — 조회 API 가 없어 dash 서버가 export 원장을 접어 준다
      fetch(`/api/online-daily?month=${month}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ]);

    // 오프라인 목표 — 같은 매장이 여러 행으로 오므로 매장당 한 번만 더한다
    const seen = new Set();
    let offTarget = 0;
    for (const r of dash?.data || []) {
      const s = r.storeName;
      if (!s || seen.has(s)) continue;
      seen.add(s);
      offTarget += Number(r.targetMonthlySales) || Number(r.targetAmount) || Number(r.monthlyTarget) || 0;
    }
    // 오프라인 매출 시스템의 "전체 매장 합계"와 같은 값이어야 비교가 된다.
    // 영업분석의 정산성 항목 제외(교환·차액 등)는 여기서 적용하지 않는다 —
    // 목표 달성률은 그 시스템 숫자를 기준으로 판단하기 때문이다.
    const offActual = (orders?.orders || [])
      .filter((o) => String(o.date || '').slice(0, 10) <= end)
      .reduce((a, o) => a + Number(o.amount || 0), 0);

    // 온라인 실적 = 자사몰·스마트스토어 + 외부몰
    const mall = (period?.rows || []).find((r) => r.channel === 'total')?.cur?.revenue || 0;
    const outside = (other?.groups || []).reduce((a, g) => a + Number(g.sales || 0), 0);

    // 카드를 펼쳤을 때 볼 것 —
    //   오프라인은 원장이 있어 일자별로 쪼갤 수 있다.
    //   온라인은 일자별 시리즈를 주는 API 가 없어(compare/daily 등 404) 채널별로 본다.
    const byDate = new Map();
    for (const o of orders?.orders || []) {
      const d = String(o.date || '').slice(0, 10);
      if (!d || d > end) continue;
      const day = byDate.get(d) || { sales: 0, stores: new Map() };
      const amt = Number(o.amount || 0);
      day.sales += amt;
      const st = o.store || '미지정';
      day.stores.set(st, (day.stores.get(st) || 0) + amt);
      byDate.set(d, day);
    }
    const offDaily = [...byDate.entries()]
      .map(([date, v]) => ({
        date,
        sales: v.sales,
        // 날짜를 누르면 그날 어느 매장이 팔았는지 — 합계만으로는 좋은 날의 이유를 모른다
        stores: [...v.stores.entries()].map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const onDailyRows = (onDaily?.success ? onDaily.daily : [])
      .filter((d) => d.date <= end)
      .map((d) => ({ date: d.date, sales: d.sales, stores: d.channels }));

    const onChannels = [
      ...(period?.rows || [])
        .filter((r) => r.channel !== 'total')
        .map((r) => ({ name: r.channel === 'cafe24' ? '자사몰 (Cafe24)' : '스마트스토어', sales: r.cur?.revenue || 0 })),
      ...(other?.groups || []).map((g) => ({ name: g.group, sales: Number(g.sales || 0) })),
    ].filter((r) => r.sales > 0).sort((a, b) => b.sales - a.sales);

    // 경과일도 같은 기준(어제까지) — API의 elapsedDays 는 오늘을 포함한다
    const elapsed = inMonth ? Number(asOf.slice(8, 10)) : 0;

    return {
      asOf,
      elapsed,
      total: target?.totalDays ?? lastDay,
      offDaily,
      onDailyRows,
      onChannels,
      offline: { target: offTarget, actual: offActual },
      online: {
        target: (target?.cafe24?.target || 0) + (target?.smartstore?.target || 0),
        actual: mall + outside,
      },
    };
  }, [tick]);

  const view = useMemo(() => {
    if (!data.data) return null;
    const d = data.data;
    const expected = d.elapsed && d.total ? (d.elapsed / d.total) * 100 : null;
    const build = (key, label, base) => {
      const target = Number(custom[key]) > 0 ? Number(custom[key]) : base.target;
      const rate = target > 0 ? (base.actual / target) * 100 : null;
      return {
        key, label, target, actual: base.actual, rate,
        gap: rate != null && expected != null ? rate - expected : null,
        edited: Number(custom[key]) > 0,
      };
    };
    return {
      expected, elapsed: d.elapsed, total: d.total, asOf: d.asOf,
      offDaily: d.offDaily, onDaily: d.onDailyRows, onChannels: d.onChannels,
      rows: [build('offline', '오프라인', d.offline), build('online', '온라인', d.online)],
    };
  }, [data.data, custom]);

  function openEditor() {
    setDraft({
      offline: String(custom.offline || view?.rows[0].target || ''),
      online: String(custom.online || view?.rows[1].target || ''),
    });
    setEditing(true);
  }

  function save() {
    const next = {};
    for (const k of ['offline', 'online']) {
      const v = Number(String(draft[k]).replace(/[^0-9]/g, ''));
      if (v > 0) next[k] = v;
    }
    setCustom(next);
    fetch('/api/targets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ month, ...next }),
    }).catch(() => {});
    setEditing(false);
  }

  function reset() {
    setCustom({});
    fetch('/api/targets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ month }),
    }).catch(() => {});
    setEditing(false);
  }

  if (data.loading) return <div className="target-strip target-loading">이번 달 목표 불러오는 중…</div>;
  if (data.error || !view) return null;

  return (
    <section className="target-strip">
      <div className="target-head">
        <strong>{month.slice(5)}월 목표 달성률</strong>
        {view.asOf && (
          <span className="target-basis">
            {Number(view.asOf.slice(5, 7))}월 {Number(view.asOf.slice(8, 10))}일까지 · 오늘 10시 반영
          </span>
        )}
        {view.elapsed > 0 && (
          // 이 숫자가 하는 말은 "지금쯤이면 이만큼 왔어야 한다"다.
          // 날짜 계산("31일 중 3일 지남")을 보여주면 그 뜻을 사람이 다시 옮겨야 한다.
          <span title={`${month.slice(5)}월 ${view.total}일 중 ${view.elapsed}일 지남`}>
            지금쯤이면 <b>{view.expected.toFixed(1)}%</b>
          </span>
        )}
        <button type="button" className="btn btn-sm" onClick={resync} disabled={syncing} title="어제까지 데이터를 다시 읽습니다">
          {syncing ? '동기화 중…' : '↻ 동기화'}
        </button>
        <button type="button" className="btn btn-sm" onClick={editing ? () => setEditing(false) : openEditor}>
          {editing ? '닫기' : '목표 입력'}
        </button>
      </div>

      {editing && (
        <div className="target-edit">
          {['offline', 'online'].map((k) => (
            <label key={k}>
              <span>{k === 'offline' ? '오프라인' : '온라인'} 목표</span>
              <input
                className="input"
                inputMode="numeric"
                value={draft[k]}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                placeholder="원 단위"
              />
            </label>
          ))}
          <button type="button" className="btn btn-download" onClick={save}>저장</button>
          <button type="button" className="btn" onClick={reset}>기본값</button>
          <p className="target-note">
            저장하면 모두가 같은 목표를 봅니다. 비우고 저장하면 원천 기본값으로 돌아갑니다.
          </p>
        </div>
      )}

      {/* 보러 오는 건 "몇 % 왔나"다. 그 숫자를 가장 크게 두고 막대·금액은 뒤에 둔다. */}
      <div className="target-cards">
        {view.rows.map((r) => (
          <button
            type="button"
            className={`target-card ${open === r.key ? 'target-card-open' : ''}`}
            key={r.key}
            onClick={() => {
              const next = open === r.key ? null : r.key;
              setOpen(next);
              if (next) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
            }}
          >
            <div className="target-card-top">
              <span className="target-card-label">
                {r.label}
                {r.edited && <em title="직접 입력한 목표">*</em>}
              </span>
              {r.gap != null && (
                <span
                  className={`target-gap ${r.gap >= 0 ? 'up' : 'down'}`}
                  title={`지금쯤 기준(${view.expected?.toFixed(1)}%)보다 ${Math.abs(r.gap).toFixed(0)}%p ${r.gap >= 0 ? '앞섬' : '뒤처짐'}`}
                >
                  {r.gap >= 0 ? '▲' : '▼'} {Math.abs(r.gap).toFixed(0)}p
                </span>
              )}
            </div>

            <strong className={`target-card-rate ${r.gap != null && r.gap < 0 ? 'behind' : ''}`}>
              {r.rate != null ? r.rate.toFixed(1) : '—'}
              <i>%</i>
            </strong>

            <div className="target-bar">
              {view.expected != null && <i className="target-mark" style={{ left: `${Math.min(view.expected, 100)}%` }} />}
              <i className="target-fill" style={{ width: `${Math.min(r.rate || 0, 100)}%` }} />
            </div>

            <div className="target-card-amt">
              <b>{eok(r.actual)}</b> / {eok(r.target)}
              <span className="target-card-more">{open === r.key ? '접기 ▲' : '자세히 ▼'}</span>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="target-detail" ref={detailRef}>
          {/* 여기서 더 파고들 곳으로 넘긴다 — 상품·사원 단위까지 허브로 끌어오면
              첫 화면만 느려지고, 그 깊이는 원래 화면이 훨씬 잘 보여준다. */}
          <div className="detail-more">
            <a href={MORE[open].href} target="_blank" rel="noopener noreferrer">
              {MORE[open].label} ↗
            </a>
          </div>
          {open === 'offline'
            ? <DailyList rows={view.offDaily} unit="매장" />
            : view.onDaily?.length
              // 온라인도 일자별로 — 오프라인과 같은 구조. 펼치면 채널별이 나온다.
              ? <DailyList rows={view.onDaily} unit="채널" />
              : <ChannelList rows={view.onChannels} />}
        </div>
      )}

    </section>
  );
}

/** 오프라인 일자별 — 원장이 있어 날짜로 쪼갤 수 있다 */
function DailyList({ rows, unit = '매장' }) {
  const [open, setOpen] = useState(null);
  if (!rows?.length) return <p className="summary">아직 이번 달 매출이 없습니다.</p>;
  const max = Math.max(1, ...rows.map((r) => r.sales));
  const total = rows.reduce((a, r) => a + r.sales, 0);
  const dow = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <>
      <p className="summary">일자별 <b>{rows.length}일</b> · 합계 <b>{fmt(total)}원</b></p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>날짜</th><th className="right">매출</th><th style={{ width: 220 }} /></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = open === r.date;
              return (
                <Fragment key={r.date}>
                  <tr
                    className={`row-click ${on ? 'row-open' : ''}`}
                    onClick={() => setOpen(on ? null : r.date)}
                    title={on ? '접기' : `${unit}별 보기`}
                  >
                    <td className="strong">
                      <span className="row-caret">{on ? '▾' : '▸'}</span>{' '}
                      {Number(r.date.slice(5, 7))}월 {Number(r.date.slice(8, 10))}일
                      <span className="dim"> ({dow[new Date(`${r.date}T00:00:00+09:00`).getDay()]})</span>
                    </td>
                    <td className="right mono strong">{fmt(r.sales)}원</td>
                    <td><div className="minibar"><div style={{ width: `${(r.sales / max) * 100}%` }} /></div></td>
                  </tr>
                  {on && (
                    <tr className="sub-row">
                      <td colSpan={3}>
                        <table className="table table-sub">
                          <thead>
                            <tr><th>{unit}</th><th className="right">매출</th><th className="right">비중</th></tr>
                          </thead>
                          <tbody>
                            {r.stores.map((st) => (
                              <tr key={st.name}>
                                <td className="strong">{st.name}</td>
                                <td className="right mono">{fmt(st.sales)}원</td>
                                <td className="right mono dim">{((st.sales / r.sales) * 100).toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * 온라인 채널별 — 일자별 시리즈를 주는 API 가 없어 채널로 나눈다.
 * 외부몰은 몰 이름 그대로 펴서 어디서 나온 매출인지 보이게 한다.
 */
function ChannelList({ rows }) {
  if (!rows?.length) return <p className="summary">아직 이번 달 매출이 없습니다.</p>;
  const max = Math.max(1, ...rows.map((r) => r.sales));
  const total = rows.reduce((a, r) => a + r.sales, 0);

  return (
    <>
      <p className="summary">채널 <b>{rows.length}곳</b> · 합계 <b>{fmt(total)}원</b></p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>채널</th><th className="right">매출</th><th className="right">비중</th><th style={{ width: 180 }} /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="strong">{r.name}</td>
                <td className="right mono strong">{fmt(r.sales)}원</td>
                <td className="right mono dim">{((r.sales / total) * 100).toFixed(0)}%</td>
                <td><div className="minibar"><div style={{ width: `${(r.sales / max) * 100}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
