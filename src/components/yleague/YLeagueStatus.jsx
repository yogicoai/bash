'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAvailableMonths, useYLeagueStatus, monthRange } from '@/hooks/useYLeague';
import { buildCast, buildJwasu, buildStore } from '@/lib/yleague/status';
import { badgeImage, rateClass } from '@/lib/yleague/rules';
import { useEmbed } from '@/components/EmbedModal';

const TABS = [
  { key: 'jwasu', label: '좌수왕', hint: '목표 좌수 달성률', note: '직영 + 위탁 (매니저/부매니저/시니어/일급제/중간관리) | 목표 좌수 대비 달성률 높은 순' },
  { key: 'cast', label: '캐스트', hint: '개인 매출 순위', note: '직영 (매니저/부매니저/시니어/일급제) | 개인별 매출 높은 순' },
  { key: 'store', label: '스토어', hint: '매장 달성률', note: '직영 + 위탁 전체 | 월 목표 매출 대비 달성률 높은 순' },
];

const EX_PEOPLE_KEY = 'dash.yleague.excludedPeople';
const EX_STORES_KEY = 'dash.yleague.excludedStores';
const SEP = '|';
const fmt = (n) => Number(n || 0).toLocaleString();

/** 좌수 원자료를 넣는 도구 — 조회 화면이 아니라 입력이라 카드로 빼지 않고 여기 둔다 */
const PREV_DATA = {
  name: '좌수 일괄등록',
  icon: '📤',
  href: 'https://yogibo.kr/off/prevData.html',
  desc: '매장 좌수 데이터 엑셀 업로드',
};

export default function YLeagueStatus() {
  const { open } = useEmbed();
  const months = useAvailableMonths();
  const [searchType, setSearchType] = useState('month');
  const [month, setMonth] = useState('');
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [tab, setTab] = useState('jwasu');
  const [jwasuFilter, setJwasuFilter] = useState('all');

  const [excludedPeople, setExcludedPeople] = useState([]);
  const [excludedStores, setExcludedStores] = useState([]);
  const [storeInput, setStoreInput] = useState('');
  const captureRef = useRef(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      setExcludedPeople(JSON.parse(localStorage.getItem(EX_PEOPLE_KEY) || '[]'));
      const st = JSON.parse(localStorage.getItem(EX_STORES_KEY) || '[]');
      setExcludedStores(st);
      setStoreInput(st.join(', '));
    } catch {
      /* 저장값이 깨졌으면 무시 */
    }
  }, []);

  useEffect(() => {
    if (!month && months.length) setMonth(months[0]);
  }, [months, month]);

  const dates = useMemo(() => {
    if (searchType === 'month') return month ? { type: 'month', month, ...monthRange(month) } : null;
    if (!range.startDate || !range.endDate) return null;
    return { type: 'range', startDate: range.startDate, endDate: range.endDate };
  }, [searchType, month, range]);

  const { dashboard, orders, mgrMap, loading, error, reload } = useYLeagueStatus(dates);

  const ranks = useMemo(() => {
    if (!mgrMap || !dates) return { jwasu: [], cast: [], store: [] };
    const common = { mgrMap, dates, excludedStores };
    return {
      jwasu: buildJwasu({ dashboard, ...common, filterType: jwasuFilter, excludedPeople }),
      cast: buildCast({ orders, ...common }),
      store: buildStore({ orders, dashboard, ...common }),
    };
  }, [dashboard, orders, mgrMap, dates, jwasuFilter, excludedPeople, excludedStores]);

  const list = ranks[tab] || [];
  const active = TABS.find((t) => t.key === tab);

  function excludePerson(name, store) {
    const key = `${store || ''}${SEP}${name}`;
    if (excludedPeople.includes(key)) return;
    const next = [...excludedPeople, key];
    setExcludedPeople(next);
    localStorage.setItem(EX_PEOPLE_KEY, JSON.stringify(next));
  }
  function resetExcluded() {
    setExcludedPeople([]);
    localStorage.removeItem(EX_PEOPLE_KEY);
  }
  function applyExcludedStores(value) {
    const next = value.split(',').map((s) => s.trim()).filter(Boolean);
    setExcludedStores(next);
    localStorage.setItem(EX_STORES_KEY, JSON.stringify(next));
  }

  async function downloadImage() {
    if (!captureRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#f5f6f8', scale: 2, useCORS: true });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      const label = dates?.type === 'month' ? dates.month : `${dates?.startDate}_${dates?.endDate}`;
      a.download = `Y리그_${active.label}_${label}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  }

  function downloadExcel() {
    if (!list.length) return;
    const head =
      tab === 'jwasu' ? ['순위', '이름', '직급', '매장', '목표', '좌수', '달성률']
      : tab === 'cast' ? ['순위', '이름', '직급', '매장', '매출']
      : ['순위', '매장', '목표', '매출', '달성률'];
    const esc = (v) => {
      const s = String(v ?? '');
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = list.map((r) =>
      tab === 'jwasu' ? [r.rank, r.name, r.role, r.storeName, r.target, r.actual, r.rate.toFixed(1) + '%']
      : tab === 'cast' ? [r.rank, r.name, r.role, r.storeName, Math.round(r.sales)]
      : [r.rank, r.storeName, r.target, Math.round(r.sales), r.rate.toFixed(1) + '%'],
    );
    const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Y리그_${active.label}_${dates?.month || dates?.endDate || ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = useMemo(() => {
    if (tab === 'jwasu') {
      const total = list.length;
      const avg = total > 0 ? list.reduce((s, r) => s + r.rate, 0) / total : 0;
      return [
        { label: '참여 인원', value: `${total}명` },
        { label: '목표 달성', value: `${list.filter((r) => r.rate >= 100).length}명`, green: true },
        { label: '평균 달성률', value: `${avg.toFixed(1)}%` },
      ];
    }
    if (tab === 'cast') {
      return [
        { label: '참여 인원', value: `${list.length}명` },
        { label: '총 매출', value: `${fmt(list.reduce((s, r) => s + r.sales, 0))} 원` },
      ];
    }
    const totalSales = list.reduce((s, r) => s + r.sales, 0);
    const totalTarget = list.reduce((s, r) => s + r.target, 0);
    return [
      { label: '전체 매장', value: `${list.length}개` },
      { label: '목표 달성', value: `${list.filter((r) => r.rate >= 100).length}개`, green: true },
      { label: '전체 달성률', value: `${totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : '0.0'}%` },
      { label: '총 매출', value: `${fmt(totalSales)}원` },
    ];
  }, [tab, list]);

  const podiumOrder = [1, 0, 2]; // 2위 · 1위 · 3위

  return (
    <div className="yl">
      <div className="yl-top">
        <div className="yl-top-row">
          <h1 className="yl-title">
            <span className="ic">🏆</span> Y 리그
          </h1>
          <div className="yl-top-actions">
            <select className="input select" value={searchType} onChange={(e) => setSearchType(e.target.value)}>
              <option value="month">월별</option>
              <option value="range">기간</option>
            </select>
            {searchType === 'month' ? (
              <select className="input select" value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <>
                <input type="date" className="input" value={range.startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} />
                <input type="date" className="input" value={range.endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} />
              </>
            )}
            <input
              className="input"
              style={{ width: 176 }}
              placeholder="제외 매장(콤마 구분)"
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              onBlur={(e) => applyExcludedStores(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyExcludedStores(e.currentTarget.value)}
            />
            <button type="button" className="yl-btn yl-btn-green" onClick={downloadExcel} disabled={!list.length}>
              ↓ 엑셀
            </button>
            <button type="button" className="yl-btn yl-btn-purple" onClick={downloadImage} disabled={saving || loading || !list.length}>
              {saving ? '저장 중…' : '🖼 이미지'}
            </button>
            <button type="button" className="yl-btn" style={{ background: '#475569' }} onClick={() => open(PREV_DATA)}>
              📤 좌수 일괄등록
            </button>
            <a className="yl-btn yl-btn-cyan" href="/yleague/ranking">매장/개인 누적 달성 현황</a>
          </div>
        </div>

        <div className="yl-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`yl-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="yl-body">
        <div className="yl-info">
          <span className="ic">i</span>
          <span>
            <b>{active.label}</b> — {active.note}
          </span>
        </div>

        {tab === 'jwasu' && (
          <div className="yl-subbar">
            <select className="input select" value={jwasuFilter} onChange={(e) => setJwasuFilter(e.target.value)}>
              <option value="all">전체 (직영+위탁)</option>
              <option value="direct">직영만</option>
              <option value="consign">위탁만</option>
            </select>
          </div>
        )}

        {excludedPeople.length > 0 && (
          <div className="yl-exrow">
            숨긴 인원: {excludedPeople.map((k) => {
              const [st, nm] = k.split(SEP);
              return nm ? `${nm}${st ? ` (${st})` : ''}` : k;
            }).join(', ')}
            <button type="button" className="yl-ex-btn" onClick={resetExcluded}>초기화</button>
          </div>
        )}

        {loading && <div className="yl-empty"><span className="ic">⏳</span>데이터 집계 중…</div>}
        {error && (
          <div className="yl-empty">
            <span className="ic">⚠️</span>{error.message}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="yl-btn yl-btn-cyan" onClick={reload}>다시 시도</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div ref={captureRef}>
            <div className="yl-summary">
              {summary.map((s) => (
                <div className="yl-sc" key={s.label}>
                  <div className="yl-sc-label">{s.label}</div>
                  <div className={`yl-sc-value ${s.green ? 'green' : ''}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {list.length === 0 ? (
              <div className="yl-empty"><span className="ic">📭</span>조회된 데이터가 없습니다.</div>
            ) : (
              <>
                <div className="yl-podium">
                  {podiumOrder.map((idx) => (list[idx] ? <Podium key={idx} item={list[idx]} rank={idx + 1} cat={tab} /> : null))}
                </div>

                <div className="yl-list">
                  <div className={`yl-head yl-g-${tab}`}>
                    <div style={{ textAlign: 'center' }}>순위</div>
                    <div>{tab === 'store' ? '매장명' : '이름'}</div>
                    {tab !== 'store' && <div>매장</div>}
                    {tab === 'jwasu' && <><div className="yl-num">목표</div><div className="yl-num">좌수</div><div className="yl-num">달성률</div></>}
                    {tab === 'cast' && <div className="yl-num">매출</div>}
                    {tab === 'store' && <><div className="yl-num">목표</div><div className="yl-num">매출</div><div className="yl-num">달성률</div></>}
                  </div>

                  {list.map((item) => (
                    <div className={`yl-row yl-g-${tab} ${item._muyeok ? 'muyeok' : ''}`} key={`${item.name}-${item.storeName}`}>
                      <RankCell rank={item.rank} cat={tab} plain={item._muyeok} />
                      <div className="yl-name-cell">
                        <div className="yl-name-row">
                          <span className="yl-name">{item.name}</span>
                          {item.consignment === 'Y' && <span className="yl-consign">위탁</span>}
                          {tab === 'jwasu' && (
                            <button type="button" className="yl-ex-btn" onClick={() => excludePerson(item.name, item.storeName)}>제외</button>
                          )}
                        </div>
                        {item.role && <span className={`yl-role yl-role-${item.role}`}>{item.role}</span>}
                      </div>
                      {tab !== 'store' && <div className="yl-store">{item.storeName}</div>}
                      {tab === 'jwasu' && (
                        <>
                          <div className="yl-num sub">{fmt(item.target)}명</div>
                          <div className="yl-num">{fmt(item.actual)}명</div>
                          <Rate rate={item.rate} />
                        </>
                      )}
                      {tab === 'cast' && <div className="yl-num hl">{fmt(item.sales)}원</div>}
                      {tab === 'store' && (
                        <>
                          <div className="yl-num sub">{fmt(item.target)}원</div>
                          <div className="yl-num hl">{fmt(item.sales)}원</div>
                          <Rate rate={item.rate} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RankCell({ rank, cat, plain }) {
  const src = plain ? null : badgeImage(cat, rank);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`yl-rank ${!plain && rank <= 3 ? 'top' : ''}`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${rank}위`} onError={() => setFailed(true)} />
      ) : (
        rank
      )}
    </div>
  );
}

function Podium({ item, rank, cat }) {
  const src = badgeImage(cat, rank);
  const [failed, setFailed] = useState(false);
  const value = cat === 'cast' ? `${fmt(item.sales)}원` : `${item.rate.toFixed(1)}%`;
  const sub = cat === 'jwasu' ? `${item.actual}/${item.target}명` : cat === 'store' ? `${fmt(item.sales)} 원` : item.storeName;

  return (
    <div className={`yl-pod yl-pod-${rank}`}>
      {src && !failed ? (
        <div className="yl-pod-medal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${rank}위`} onError={() => setFailed(true)} />
        </div>
      ) : (
        <div className="yl-pod-num">{rank}</div>
      )}
      <div className="yl-pod-name">
        {item.name}
        {item.consignment === 'Y' && <span className="yl-consign">위탁</span>}
      </div>
      <div className="yl-pod-value">{value}</div>
      <div className="yl-pod-sub">{sub}</div>
    </div>
  );
}

function Rate({ rate }) {
  const cls = rateClass(rate);
  return (
    <div className="yl-rate">
      <div className={`yl-rate-v ${cls}`}>{rate.toFixed(1)}%</div>
      <div className="yl-rate-bar"><i className={cls} style={{ width: `${Math.min(rate, 100)}%` }} /></div>
    </div>
  );
}
