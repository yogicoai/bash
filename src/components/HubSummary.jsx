'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import TodaySales from '@/app/sales/today/TodaySales';
import DataState from './DataState';
import { onGet } from '@/lib/api';
import { canSync, markSync, waitMinutes } from '@/lib/syncGate';
import { useAsync } from '@/hooks/useAsync';
import { useViewMode } from './ViewMode';
import { rtGet } from '@/lib/api';
import { isExcludedProduct, isExcludedStore } from '@/lib/sales/config';
import { buildRawOrders } from '@/lib/sales/normalize';

/**
 * 허브 요약 — 채널별 매출. 클릭하지 않고도 보이게 한다.
 *
 * 갱신 시점이 다르므로 라벨로 구분한다.
 *   실시간 매출 = 오프라인 매장 당일 (이카운트 10분 주기)
 *   월별 매출   = 매일 오전 10시 기준, 어제까지 반영된 누적
 *
 * 실시간으로 볼 수 있는 범위만 얹는다.
 *   오프라인 : 매장 전체 (이카운트 10분 주기)   realtime /api/orders
 *   온라인   : Cafe24  onlineData /api/cafe24/daily-summary (당월 누적)
 *              스마트스토어 onlineData /api/smartstore/analysis (당월 1일~오늘)
 * ※ /api/sync-today · /api/refresh-today 는 조회가 아니라 수집 작업을 돌리는 엔드포인트다.
 *   화면에서 직접 부르지 않고 dash 서버의 /api/auto-sync 를 거친다 — 거기서 잠금을 건다.
 * 외부몰(쿠팡·오늘의집 등)은 이카운트 일 단위라 오늘치가 없다. 그래서 다른 타일과 달리
 * 어제 하루를 보여주고 그 사실을 타일에 적는다 — 빼두면 그만큼이 어디에도 안 잡힌다.
 *
 * 새 백엔드 없이 각 화면이 이미 쓰는 API를 그대로 재사용한다.
 */
const fmt = (n) => Math.round(n || 0).toLocaleString();
const won = (n) => `${fmt(n)}원`;
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

/**
 * 동기화 버튼 — 페이지를 열 때 자동으로 한 번 돌기 때문에 평소엔 누를 일이 없다.
 * 방금 돌았으면 남은 시간을 보여주며 잠근다(연타 방지). 수집 작업이라 자주 돌릴수록
 * 원천 API 에 부담이 간다.
 */
function SyncButton({ syncKey, onDone }) {
  const [state, setState] = useState('idle');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    const tick = () => setWait(waitMinutes(syncKey));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [syncKey]);

  async function run(e) {
    e.preventDefault();
    e.stopPropagation();
    if (wait > 0) return;
    setState('running');
    markSync(syncKey);
    setWait(waitMinutes(syncKey));
    try {
      await fetch('/api/auto-sync', { cache: 'no-store' });
      // 작업이 백그라운드로 도는 동안 잠시 기다렸다가 값을 다시 읽는다
      setTimeout(() => { setState('idle'); onDone?.(); }, 6000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const label =
    state === 'running' ? '동기화 중…'
    : state === 'error' ? '실패'
    : wait > 0 ? `${wait}분 뒤 가능`
    : '↻ 동기화';

  return (
    <button
      type="button"
      className="hub-sync"
      onClick={run}
      disabled={state === 'running' || wait > 0}
      title={wait > 0 ? '방금 동기화했습니다' : '지금 동기화'}
    >
      {label}
    </button>
  );
}

/** 채널별 오늘 판매 상품 — 자사몰은 compare/best, 스마트스토어는 analysis.productTop */
/**
 * 오늘이 얼마나 지났나 (0~1).
 *
 * 목표(방문·가입)는 하루 전체 기준인데 지금 값은 진행 중이다. 그대로 나누면
 * 오전에는 무조건 미달로 보인다. 그래서 시간 진행률을 같이 두고 견준다.
 *
 * ⚠ 단순히 흐른 시간으로 계산한다. 실제 쇼핑은 저녁에 몰리므로 오전에는 이
 *   기준이 실제보다 후하다 — 그래서 "뒤처짐" 판정은 넉넉히 밀린 경우에만 한다.
 */
function dayProgressKST() {
  const hm = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = hm.split(':').map(Number);
  return Math.min(1, (h * 60 + m) / (24 * 60));
}

const pctText = (v) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%` : '—');
const rate1 = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—');

/** 지표 한 줄 — 값 · 목표(또는 비교 대상) · 달성 여부 */
function Metric({ label, value, note, tone, hint }) {
  return (
    <div className={`kpi-cell${tone ? ` kpi-${tone}` : ''}`} title={hint}>
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{value}</b>
      {note && <span className="kpi-note">{note}</span>}
    </div>
  );
}

/**
 * 자사몰 — 오늘의 방문·전환.
 *
 * 매출은 결과라서 낮게 나와도 원인을 알 수 없다. 방문이 적었는지, 들어왔는데
 * 안 샀는지가 갈리는데 대응이 정반대다(광고 vs 상품·가격). daily-summary 가
 * 이미 주는 값이라 새 호출 없이 그 구분을 보여준다.
 */
function Cafe24Check({ d }) {
  if (!d) return null;
  const { check, mtd } = d;
  if (!check && !mtd) return null;
  const v = check?.visits;
  const c = check?.purchaseRate;
  const su = check?.signups;

  const prog = dayProgressKST();
  // 앞서면 초록, 눈에 띄게 밀렸을 때만 빨강. 애매한 구간은 색을 주지 않는다 —
  // 시간 기준이 어림이라 어중간한 차이로 판단을 몰아가면 안 된다.
  const pace = (achieved) =>
    achieved == null ? null : achieved >= prog ? 'good' : achieved < prog * 0.7 ? 'warn' : null;
  // 목표는 하루 전체 기준이라 지금 값과 그냥 견주면 오전엔 늘 미달이다.
  // 진행률은 색 판정에만 쓰고, 근거가 궁금하면 마우스를 올려 보게 한다.
  const paceHint = `목표는 하루 전체 기준 · 지금 ${rate1(prog)} 지남`;

  return (
    <div className="kpi-row">
      {v && (
        <Metric
          label="방문"
          value={`${fmt(v.today)}명`}
          note={`목표 ${fmt(v.target)}명 · ${rate1(v.achieveRate)}`}
          tone={pace(v.achieveRate)}
          hint={paceHint}
        />
      )}
      {c && (
        <Metric
          label="구매전환"
          value={rate1(c.today)}
          note={`목표 ${rate1(c.target)} · 주문 ${fmt(c.orders)}건`}
          tone={c.today >= c.target ? 'good' : 'warn'}
        />
      )}
      {su && (
        <Metric
          label="가입"
          value={`${fmt(su.today)}명`}
          note={`목표 ${fmt(Math.round(su.target))}명`}
          tone={pace(su.target ? su.today / su.target : null)}
          hint={paceHint}
        />
      )}
      {mtd && (
        <Metric
          label={`${Number(today0().slice(5, 7))}월 누적`}
          value={won(mtd.revenue)}
          note={`작년 ${pctText(mtd.yoy?.rate)} · 전월 ${pctText(mtd.mom?.rate)}`}
          tone={mtd.yoy?.rate >= 0 ? 'good' : 'warn'}
        />
      )}
    </div>
  );
}

/**
 * 스마트스토어 — 매출과 실입금은 다르다.
 * 할인·수수료를 떼고 실제로 들어오는 금액(정산)까지 같이 봐야 자사몰과 나란히 비교된다.
 */
function SmartstoreCheck({ kpis, inflow }) {
  if (!kpis) return null;
  const top = (inflow || []).filter((r) => r.orders > 0).slice(0, 3);
  const totalOrders = (inflow || []).reduce((a, r) => a + (r.orders || 0), 0);

  return (
    <>
    <div className="kpi-row">
      <Metric label="매출" value={won(kpis.revenue)} note={`주문 ${fmt(kpis.orders)}건`} />
      <Metric label="할인" value={`-${won(kpis.discount)}`} note="즉시·쿠폰 등" />
      <Metric label="수수료" value={`-${won(kpis.commission)}`} note={rate1(kpis.commissionRate)} />
      <Metric label="정산(실입금)" value={won(kpis.settlement)} note={`객단가 ${won(kpis.aov)}`} tone="good" />
    </div>
    {top.length > 0 && (
      // 스마트스토어는 방문 수를 주지 않아 전환율을 낼 수 없다.
      // 대신 "어디를 거쳐 샀는지"로 유입을 본다.
      <div className="inflow-row">
        <span className="inflow-label">유입 경로</span>
        {top.map((r) => (
          <span className="inflow-chip" key={r.inflow}>
            {r.inflow}
            <b>{fmt(r.orders)}건</b>
            {totalOrders > 0 && <i>{rate1(r.orders / totalOrders)}</i>}
          </span>
        ))}
      </div>
    )}
    </>
  );
}

/**
 * 외부몰 — 분류별로 무엇이 팔렸는지.
 * 몰 목록은 아래 표가 맡고, 여기서는 상품 분류(소파·바디필로우·케어 등)를 본다.
 */
function OtherCheck({ d }) {
  if (!d?.totals) return null;
  const cats = d.categories || [];
  const sum = cats.reduce((a, c) => a + Number(c.sales || 0), 0);

  return (
    <>
      <div className="kpi-row">
        <Metric label="매출" value={won(d.totals.sales)} note={`주문 ${fmt(d.totals.orders)}건`} />
        <Metric label="판매 수량" value={`${fmt(d.totals.qty)}개`} note={`몰 ${fmt(d.totals.groups)}곳`} />
        <Metric label="객단가" value={won(d.totals.aov)} note="매출 ÷ 주문" />
      </div>
      {cats.length > 0 && (
        <div className="inflow-row">
          <span className="inflow-label">분류별</span>
          {cats.map((c) => (
            <span className="inflow-chip" key={c.category}>
              {c.category}
              <b>{won(c.sales)}</b>
              <i>{c.qty}개{sum ? ` · ${((c.sales / sum) * 100).toFixed(0)}%` : ''}</i>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

const today0 = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

function ChannelDetail({ channel }) {
  const today = todayKST();
  const data = useAsync(async () => {
    if (channel === 'cafe24') {
      const [best, sum] = await Promise.all([
        onGet('api/compare/best', { start: today, end: today }),
        onGet('api/cafe24/daily-summary', { date: today }).catch(() => null),
      ]);
      return {
        rows: (best?.cafe24 || []).map((r) => ({ name: r.name, qty: r.qty, sales: r.sales })),
        check: sum?.check || null,
        mtd: sum?.mtd || null,
      };
    }
    if (channel === 'other') {
      // 외부몰은 이카운트 일 단위라 어제 하루를 본다 (타일과 같은 기준)
      const y = new Date(`${today}T00:00:00+09:00`);
      y.setDate(y.getDate() - 1);
      const d = y.toLocaleDateString('sv-SE');
      const j = await onGet('api/other/overview', { start: d, end: d });
      return {
        rows: (j?.groups || []).map((g) => ({
          name: g.group, qty: g.qty, sales: g.sales, orders: g.orders,
          subs: (g.subs || []).map((x) => x.store).filter((x) => x && x !== g.group),
        })),
        categories: j?.byCategory || [],
        totals: j?.totals || null,
        date: d,
      };
    }

    const j = await onGet('api/smartstore/analysis', { start: today, end: today });
    return {
      rows: (j?.productTop || []).map((r) => ({ name: r.name, qty: r.qty, sales: r.sales, tier: r.tier })),
      kpis: j?.kpis || null,
      inflow: j?.inflow || null,
    };
  }, [channel]);

  const rows = data.data?.rows || [];
  const max = Math.max(1, ...rows.map((r) => r.sales));
  const total = rows.reduce((a, r) => a + (r.sales || 0), 0);

  return (
    <>
      <DataState
        loading={data.loading}
        error={data.error}
        empty={!data.loading && !data.error && rows.length === 0}
        emptyText={channel === 'other' ? '어제 외부몰 판매가 없습니다.' : '오늘 판매된 상품이 없습니다.'}
        onRetry={data.reload}
      />
      {channel === 'cafe24' && <Cafe24Check d={data.data} />}
      {channel === 'smartstore' && <SmartstoreCheck kpis={data.data?.kpis} inflow={data.data?.inflow} />}
      {channel === 'other' && <OtherCheck d={data.data} />}
      {rows.length > 0 && (
        <>
          <p className="summary">
            {channel === 'other' ? '몰' : '상품'} <b>{rows.length}{channel === 'other' ? '곳' : '종'}</b>
            {' · 합계 '}<b>{won(total)}</b>
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="col-narrow center">순위</th>
                  <th>{channel === 'other' ? '몰' : '상품'}</th>
                  {channel === 'smartstore' && <th>등급</th>}
                  <th className="right">수량</th>
                  <th className="right">매출</th>
                  <th style={{ width: 130 }}>비중</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name + i}>
                    <td className="center"><span className="rank-badge">{i + 1}</span></td>
                    <td className="strong">{r.name}</td>
                    {channel === 'smartstore' && <td><span className="pill">{r.tier || '-'}</span></td>}
                    <td className="right mono">{fmt(r.qty)}</td>
                    <td className="right mono strong">{won(r.sales)}</td>
                    <td><div className="minibar"><div style={{ width: `${(r.sales / max) * 100}%` }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default function HubSummary() {
  const { mode } = useViewMode();
  const [openDetail, setOpenDetail] = useState(null);
  const detailRef = useRef(null);

  // 한 페이지 모드에서는 이동하지 않고 아래로 펼친 뒤 그 위치로 스크롤한다
  const toggleDetail = (key) => {
    const next = openDetail === key ? null : key;
    setOpenDetail(next);
    if (next) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  /**
   * 페이지를 열 때 수집을 한 번 돌린다.
   *
   * 예전에는 사람이 "↻ 동기화"를 눌러야만 금액이 최신이 됐다. 이제 들어오면 알아서
   * 돌되, 새로고침할 때마다 다시 돌지 않게 쿠키로 10분 잠금을 건다. 서버(/api/auto-sync)
   * 에도 같은 잠금이 있어 여러 사람이 동시에 들어와도 한 번만 돈다.
   *
   * 수집은 응답 뒤에 시작되므로(서버 after) 넉넉히 기다렸다가 값을 다시 읽는다.
   */
  useEffect(() => {
    if (!canSync('auto')) return;
    markSync('auto');
    let alive = true;
    fetch('/api/auto-sync', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        for (const k of j?.synced || []) markSync(k);
        if (!alive || !j?.synced?.length) return;
        setTimeout(() => {
          if (!alive) return;
          if (j.synced.includes('cafe24')) cafe24.reload();
          if (j.synced.includes('smartstore')) smartstore.reload();
        }, 20_000);
      })
      .catch(() => {
        /* 수집이 실패해도 화면은 마지막으로 모인 값을 그대로 보여준다 */
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const d = json?.daily;
    if (!d) return null;
    return { revenue: d.revenue, rate: d.rate, prev: d.prevRevenue };
  }, []);

  /**
   * 스마트스토어 — 오늘.
   * 동기화가 밀려 있으면 매출이 0으로 나온다. 그대로 두면 "판매 없음"으로 읽히므로
   * 동기화 상태(meta.to)를 같이 보고 뒤처져 있으면 숫자 대신 그 사실을 표시한다.
   */
  const smartstore = useAsync(async () => {
    const today = todayKST();
    const [json, status] = await Promise.all([
      onGet('api/smartstore/analysis', { start: today, end: today }),
      onGet('api/smartstore/status').catch(() => null),
    ]);
    const k = json?.kpis;
    if (!k) return null;
    const syncedTo = status?.meta?.to || null;
    return { revenue: k.revenue, orders: k.orders, syncedTo, stale: Boolean(syncedTo && syncedTo < today) };
  }, []);

  /**
   * 외부몰 — 쿠팡·오늘의집·현대 이지웰 등 자사몰·스마트스토어를 뺀 나머지.
   * 이카운트 일 단위 적재라 오늘치가 없다. 그래서 어제 하루를 본다.
   */
  const other = useAsync(async () => {
    const y = new Date(`${todayKST()}T00:00:00+09:00`);
    y.setDate(y.getDate() - 1);
    const d = y.toLocaleDateString('sv-SE');
    const j = await onGet('api/other/overview', { start: d, end: d });
    return {
      date: d,
      sales: j?.totals?.sales || 0,
      orders: j?.totals?.orders || 0,
      malls: (j?.groups || []).length,
    };
  }, []);

  const pct = (r) => (typeof r === 'number' ? `${r > 0 ? '+' : ''}${(r * 100).toFixed(0)}%` : null);

  const tiles = [
    {
      href: '/sales/today',
      detailKey: 'offline',
      label: '오프라인 매장',
      value: offline.data ? won(offline.data.todayAmount) : null,
      sub: offline.data ? `구매 ${fmt(offline.data.todayOrders)}건` : null,
      state: offline,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      detailKey: 'cafe24',
      label: '자사몰 (Cafe24)',
      value: cafe24.data ? won(cafe24.data.revenue) : null,
      sub: cafe24.data
        ? `어제 ${won(cafe24.data.prev)}${pct(cafe24.data.rate) ? ` · ${pct(cafe24.data.rate)}` : ''} · 오늘은 진행 중`
        : null,
      syncKey: 'cafe24',
      onSynced: () => cafe24.reload(),
      state: cafe24,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      detailKey: 'smartstore',
      label: '스마트스토어',
      value: smartstore.data ? (smartstore.data.stale ? '동기화 필요' : won(smartstore.data.revenue)) : null,
      sub: smartstore.data
        ? smartstore.data.stale
          ? `${smartstore.data.syncedTo}까지만 반영됨 — 판매분석에서 재동기화`
          : `주문 ${fmt(smartstore.data.orders)}건`
        : null,
      tone: smartstore.data?.stale ? 'stale' : null,
      syncKey: 'smartstore',
      onSynced: () => smartstore.reload(),
      state: smartstore,
    },
    {
      href: 'https://on-iota-three.vercel.app/',
      external: true,
      detailKey: 'other',
      label: '외부몰',
      value: other.data ? won(other.data.sales) : null,
      // 다른 타일은 오늘인데 여기만 어제다 — 그 사실을 타일에 적어 오해를 막는다
      sub: other.data
        ? `${Number(other.data.date.slice(5, 7))}월 ${Number(other.data.date.slice(8, 10))}일(어제) · ${fmt(other.data.malls)}곳 · 주문 ${fmt(other.data.orders)}건`
        : null,
      state: other,
    },
  ];

  return (
    <>
      <div className="hub">
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

        // 한 페이지 모드면 이동 대신 아래로 펼친다
        if (t.detailKey && mode === 'popup') {
          const on = openDetail === t.detailKey;
          const more =
            t.detailKey === 'offline' ? '매장별 보기'
            : t.detailKey === 'other' ? '몰별 보기'
            : '판매 상품 보기';
          return (
            <div className="hub-wrap" key={t.label}>
              <button type="button" className={`${cls} ${on ? 'hub-open' : ''}`} onClick={() => toggleDetail(t.detailKey)}>
                {body}
                <span className="hub-more">{on ? '접기 ▲' : `${more} ▼`}</span>
              </button>
              {t.syncKey && <SyncButton syncKey={t.syncKey} onDone={t.onSynced} />}
            </div>
          );
        }

        const inner = t.external ? (
          <a className={cls} href={t.href} target="_blank" rel="noopener noreferrer">{body}</a>
        ) : (
          <Link className={cls} href={t.href}>{body}</Link>
        );

        return t.syncKey ? (
          <div className="hub-wrap" key={t.label}>
            {inner}
            <SyncButton syncKey={t.syncKey} onDone={t.onSynced} />
          </div>
        ) : (
          <div className="hub-wrap" key={t.label}>{inner}</div>
        );
      })}
      </div>

      {mode === 'popup' && openDetail && (
        <div className="hub-detail" ref={detailRef}>
          <div className="hub-detail-head">
            <h2>
              {openDetail === 'offline' ? '실시간 매장별 매출'
                : openDetail === 'cafe24' ? '자사몰 오늘 판매 상품'
                : '스마트스토어 오늘 판매 상품'}
            </h2>
            <button type="button" className="btn btn-sm" onClick={() => toggleDetail(openDetail)}>접기 ▲</button>
          </div>
          {openDetail === 'offline' ? <TodaySales /> : <ChannelDetail channel={openDetail} />}
        </div>
      )}
    </>
  );
}
