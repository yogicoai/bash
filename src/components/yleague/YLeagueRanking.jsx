'use client';

import { useMemo, useRef, useState } from 'react';
import { useCumulativeMonths, useYLeagueCumulative } from '@/hooks/useYLeague';
import { buildCumulative } from '@/lib/yleague/cumulative';
import { LEAGUE_YEAR, UNRANK_MONTH, isUnrankStore, storeLogo } from '@/lib/yleague/rules';

const UNRANK_MONTH_NO = Number(UNRANK_MONTH.slice(5, 7));

const SECTIONS = [
  { key: 'jwasu', title: '좌수왕', hasName: true },
  { key: 'cast', title: '캐스트', hasName: true },
  { key: 'store', title: '스토어', hasName: false },
];

export default function YLeagueRanking() {
  const monthOptions = useCumulativeMonths();
  const [targetMonth, setTargetMonth] = useState(() => monthOptions[monthOptions.length - 1] || 1);
  const { monthly, mgrMap, loading, error, progress, refresh } = useYLeagueCumulative(targetMonth);
  const captureRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => {
    if (!mgrMap || !monthly.length) return { jwasu: [], cast: [], store: [] };
    return buildCumulative(monthly, targetMonth, mgrMap);
  }, [monthly, targetMonth, mgrMap]);

  async function downloadImage() {
    if (!captureRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#f5f6f8', scale: 2, useCORS: true });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `Y리그_누적랭킹_${LEAGUE_YEAR}-${String(targetMonth).padStart(2, '0')}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="yl">
      <div className="ylr-top">
        <div className="yl-top-row">
          <h1 className="yl-title">
            <span className="ic">👑</span> {LEAGUE_YEAR}년 Y리그 매장/개인 누적 달성 현황
          </h1>
          <div className="yl-top-actions">
            <select className="input select" value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{LEAGUE_YEAR}년 {m}월 누적 조회</option>
              ))}
            </select>
            <button type="button" className="yl-btn yl-btn-cyan" onClick={refresh} disabled={loading}>
              {loading && progress.total ? `불러오는 중 ${progress.done}/${progress.total}` : '조회하기'}
            </button>
            <button type="button" className="yl-btn" style={{ background: '#2563eb' }} onClick={downloadImage} disabled={saving || loading}>
              {saving ? '저장 중…' : '이미지 다운로드'}
            </button>
          </div>
        </div>
      </div>

      <div className="ylr-body">
        {loading && <div className="yl-empty"><span className="ic">⏳</span>{progress.total ? `월별 데이터 집계 중… ${progress.done}/${progress.total}개월` : '집계 중…'}</div>}
        {error && <div className="yl-empty"><span className="ic">⚠️</span>{error.message}</div>}

        {!loading && !error && (
          <div className="ylr-grid" ref={captureRef}>
            {SECTIONS.map((s) => (
              <div className="ylr-card" key={s.key}>
                <h2>{LEAGUE_YEAR}년 {s.title}</h2>
                <RankTable rows={result[s.key]} hasName={s.hasName} targetMonth={targetMonth} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RankTable({ rows, hasName, targetMonth }) {
  if (!rows.length) return <div className="ylr-empty">해당 월에 활성화된 데이터가 존재하지 않습니다.</div>;
  const muyeokMonth = targetMonth === UNRANK_MONTH_NO;

  return (
    <div className="ylr-scroll">
      <table className="ylr-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>매장명</th>
            {hasName && <th>성명</th>}
            <th>누적 개월수</th>
            <th>달성</th>
            <th>미달성</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const logo = storeLogo(r.storeName);
            const muyeok = muyeokMonth && isUnrankStore(r.storeName);
            return (
              <tr key={`${r.storeName}_${r.name}`} className={muyeok ? 'muyeok' : ''}>
                <td className="ylr-rank">{r.rank}</td>
                <td className="store">
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="ylr-logo" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  )}
                  {r.storeName}
                </td>
                {hasName && <td className="name">{r.name}</td>}
                <td>{r.totalMonths}</td>
                <td className="ylr-ach">{r.achieved}</td>
                <td className="ylr-fail">{r.failed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
