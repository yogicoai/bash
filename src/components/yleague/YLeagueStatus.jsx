'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DataState from '@/components/DataState';
import { useAvailableMonths, useYLeagueStatus, monthRange } from '@/hooks/useYLeague';
import { buildCast, buildJwasu, buildStore } from '@/lib/yleague/status';
import { badgeImage, rateClass } from '@/lib/yleague/rules';

const TABS = [
  { key: 'jwasu', label: '좌수왕', note: '부매니저·시니어·일급제·중간관리·매니저 | 목표 좌수 대비 달성률 높은 순' },
  { key: 'cast', label: '캐스트', note: '직영 (매니저·부매니저·시니어·일급제) | 개인별 매출 높은 순' },
  { key: 'store', label: '스토어', note: '직영 + 위탁 전체 | 월 목표 매출 대비 달성률 높은 순' },
];

const EX_PEOPLE_KEY = 'dash.yleague.excludedPeople';
const EX_STORES_KEY = 'dash.yleague.excludedStores';
const SEP = '|';

const fmt = (n) => Number(n || 0).toLocaleString();

export default function YLeagueStatus() {
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

  // localStorage는 마운트 후에만 (SSR 불일치 방지)
  useEffect(() => {
    try {
      setExcludedPeople(JSON.parse(localStorage.getItem(EX_PEOPLE_KEY) || '[]'));
      const st = JSON.parse(localStorage.getItem(EX_STORES_KEY) || '[]');
      setExcludedStores(st);
      setStoreInput(st.join(', '));
    } catch {
      /* 저장된 값이 깨졌으면 무시 */
    }
  }, []);

  useEffect(() => {
    if (!month && months.length) setMonth(months[0]);
  }, [months, month]);

  const dates = useMemo(() => {
    if (searchType === 'month') {
      if (!month) return null;
      return { type: 'month', month, ...monthRange(month) };
    }
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

  function excludePerson(name, store) {
    const key = `${store || ''}${SEP}${name}`;
    if (excludedPeople.includes(key)) return;
    const next = [...excludedPeople, key];
    setExcludedPeople(next);
    localStorage.setItem(EX_PEOPLE_KEY, JSON.stringify(next));
  }
  function resetExcludedPeople() {
    setExcludedPeople([]);
    localStorage.removeItem(EX_PEOPLE_KEY);
  }
  function applyExcludedStores() {
    const next = storeInput.split(',').map((s) => s.trim()).filter(Boolean);
    setExcludedStores(next);
    localStorage.setItem(EX_STORES_KEY, JSON.stringify(next));
  }

  async function downloadImage() {
    if (!captureRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#0e1014',
        scale: 2,
        useCORS: true,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      const label = dates?.type === 'month' ? dates.month : `${dates?.startDate}_${dates?.endDate}`;
      a.download = `Y리그_${TABS.find((t) => t.key === tab).label}_${label}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    if (tab === 'jwasu') {
      const total = list.length;
      const achieved = list.filter((r) => r.rate >= 100).length;
      const avg = total > 0 ? list.reduce((s, r) => s + r.rate, 0) / total : 0;
      return [
        { label: '참여 인원', value: `${total}명` },
        { label: '목표 달성', value: `${achieved}명`, good: true },
        { label: '평균 달성률', value: `${avg.toFixed(1)}%` },
      ];
    }
    if (tab === 'cast') {
      return [
        { label: '참여 인원', value: `${list.length}명` },
        { label: '총 매출', value: `${fmt(list.reduce((s, r) => s + r.sales, 0))}원` },
      ];
    }
    const totalSales = list.reduce((s, r) => s + r.sales, 0);
    const totalTarget = list.reduce((s, r) => s + r.target, 0);
    return [
      { label: '전체 매장', value: `${list.length}개` },
      { label: '목표 달성', value: `${list.filter((r) => r.rate >= 100).length}개`, good: true },
      { label: '전체 달성률', value: `${totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : '0.0'}%` },
      { label: '총 매출', value: `${fmt(totalSales)}원` },
    ];
  }, [tab, list]);

  return (
    <>
      <section className="period-bar">
        <div className="period-title">
          <span className="period-icon">🏆</span>
          <div>
            <div className="period-label">조회 기간</div>
            <div className="period-value">
              {dates ? (dates.type === 'month' ? dates.month : `${dates.startDate} ~ ${dates.endDate}`) : '기간을 선택하세요'}
            </div>
          </div>
        </div>

        <div className="period-presets">
          <select className="input select" value={searchType} onChange={(e) => setSearchType(e.target.value)}>
            <option value="month">월별 조회</option>
            <option value="range">기간 조회</option>
          </select>
          {searchType === 'month' ? (
            <select className="input select" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <div className="period-custom">
              <input type="date" className="input" value={range.startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} />
              <span className="period-dash">~</span>
              <input type="date" className="input" value={range.endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} />
            </div>
          )}
        </div>

        <div className="actions">
          {tab === 'jwasu' && (
            <select className="input select" value={jwasuFilter} onChange={(e) => setJwasuFilter(e.target.value)}>
              <option value="all">전체</option>
              <option value="direct">직영만</option>
              <option value="consign">위탁만</option>
            </select>
          )}
          <button type="button" className="btn" onClick={downloadImage} disabled={saving || loading || !list.length}>
            {saving ? '저장 중…' : '↓ 이미지 저장'}
          </button>
        </div>
        {loading && <div className="period-progress active" />}
      </section>

      <div className="toolbar yl-exclude">
        <label className="yl-ex-label">제외 매장</label>
        <input
          className="input"
          value={storeInput}
          placeholder="쉼표로 구분 (예: 요기보매니저영업, 폐점매장)"
          onChange={(e) => setStoreInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyExcludedStores()}
        />
        <button type="button" className="btn btn-sm" onClick={applyExcludedStores}>적용</button>
        {excludedPeople.length > 0 && (
          <span className="yl-ex-people">
            숨긴 인원: {excludedPeople.map((k) => {
              const [st, nm] = k.split(SEP);
              return nm ? `${nm}${st ? ` (${st})` : ''}` : k;
            }).join(', ')}
            <button type="button" className="btn btn-sm" onClick={resetExcludedPeople}>초기화</button>
          </span>
        )}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="section-info">
        <span className="info-icon">i</span>
        <span><b>{TABS.find((t) => t.key === tab).label}</b> — {TABS.find((t) => t.key === tab).note}</span>
      </div>

      <DataState loading={loading} error={error} onRetry={reload} />

      {!loading && !error && (
        <div ref={captureRef} className="yl-capture">
          <div className="summary-bar">
            {summary.map((s) => (
              <div className="summary-card" key={s.label}>
                <div className="sc-label">{s.label}</div>
                <div className={`sc-value ${s.good ? 'good' : ''}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="chart-empty"><div className="chart-empty-ic">📭</div>조회된 데이터가 없습니다.</div>
          ) : (
            <>
              <div className="podium">
                {list.slice(0, 3).map((item, i) => (
                  <Podium key={`${item.name}-${item.storeName}`} item={item} rank={i + 1} cat={tab} />
                ))}
              </div>

              <div className="rank-list">
                <div className={`rank-head grid-${tab}`}>
                  <div className="center">순위</div>
                  <div>{tab === 'store' ? '매장명' : '이름'}</div>
                  {tab !== 'store' && <div>매장</div>}
                  {tab === 'jwasu' && <><div className="right">목표</div><div className="right">좌수</div><div className="right">달성률</div></>}
                  {tab === 'cast' && <div className="right">매출</div>}
                  {tab === 'store' && <><div className="right">목표</div><div className="right">매출</div><div className="right">달성률</div></>}
                </div>

                {list.map((item) => (
                  <div className={`rank-row grid-${tab} ${item._muyeok ? 'muyeok' : ''}`} key={`${item.name}-${item.storeName}`}>
                    <div className="center">
                      <RankCell rank={item.rank} cat={tab} plain={item._muyeok} />
                    </div>
                    <div className="rank-name-cell">
                      <span className="rank-person-name">{item.name}</span>
                      {item.role && <span className="rank-role-badge">{item.role}</span>}
                      {item.consignment === 'Y' && <span className="consign-badge">위탁</span>}
                      {tab === 'jwasu' && (
                        <button type="button" className="btn-exclude" onClick={() => excludePerson(item.name, item.storeName)}>제외</button>
                      )}
                    </div>
                    {tab !== 'store' && <div className="rank-store-name">{item.storeName}</div>}
                    {tab === 'jwasu' && (
                      <>
                        <div className="right dim-inline">{fmt(item.target)}명</div>
                        <div className="right strong">{fmt(item.actual)}명</div>
                        <RateCell rate={item.rate} />
                      </>
                    )}
                    {tab === 'cast' && <div className="right strong accent">{fmt(item.sales)}원</div>}
                    {tab === 'store' && (
                      <>
                        <div className="right dim-inline">{fmt(item.target)}원</div>
                        <div className="right strong accent">{fmt(item.sales)}원</div>
                        <RateCell rate={item.rate} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function RankCell({ rank, cat, plain }) {
  const src = plain ? null : badgeImage(cat, rank);
  const [failed, setFailed] = useState(false);
  if (src && !failed)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${rank}위`} className="rank-medal-img" onError={() => setFailed(true)} />;
  return <span className={`rank-num ${!plain && rank <= 3 ? 'top' : ''}`}>{rank}</span>;
}

function Podium({ item, rank, cat }) {
  const src = badgeImage(cat, rank);
  const [failed, setFailed] = useState(false);
  const value =
    cat === 'cast' ? `${fmt(item.sales)}원` : `${item.rate.toFixed(1)}%`;
  const sub =
    cat === 'jwasu' ? `${item.actual}/${item.target}명` : cat === 'store' ? `${fmt(item.sales)}원` : item.storeName;

  return (
    <div className={`podium-card rank-${rank}`}>
      <div className="podium-medal-wrap">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${rank}위`} className="podium-medal-img" onError={() => setFailed(true)} />
        ) : (
          <div className="podium-medal">{rank}</div>
        )}
      </div>
      <div className="podium-name">
        {item.name}
        {item.consignment === 'Y' && <span className="consign-badge">위탁</span>}
      </div>
      <div className="podium-value">{value}</div>
      <div className="podium-sub">{sub}</div>
    </div>
  );
}

function RateCell({ rate }) {
  const cls = rateClass(rate);
  return (
    <div className="rate-cell">
      <div className={`rate-value ${cls}`}>{rate.toFixed(1)}%</div>
      <div className="rate-bar"><div className={`rate-bar-inner ${cls}`} style={{ width: `${Math.min(rate, 100)}%` }} /></div>
    </div>
  );
}
