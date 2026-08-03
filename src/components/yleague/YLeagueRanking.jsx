'use client';

import { useMemo, useRef, useState } from 'react';
import DataState from '@/components/DataState';
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
  const { monthly, mgrMap, loading, error, progress, reload } = useYLeagueCumulative(targetMonth);
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
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#f8fafc', scale: 2, useCORS: true });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `Y리그_누적랭킹_${LEAGUE_YEAR}-${String(targetMonth).padStart(2, '0')}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="period-bar">
        <div className="period-title">
          <span className="period-icon">📊</span>
          <div>
            <div className="period-label">누적 조회</div>
            <div className="period-value">{LEAGUE_YEAR}년 1월 ~ {targetMonth}월</div>
          </div>
        </div>

        <div className="period-presets">
          <select className="input select" value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{LEAGUE_YEAR}년 {m}월 누적 조회</option>
            ))}
          </select>
        </div>

        <div className="actions">
          {loading && progress.total > 0 && (
            <span className="badge">불러오는 중 {progress.done}/{progress.total}개월</span>
          )}
          <button type="button" className="btn" onClick={downloadImage} disabled={saving || loading}>
            {saving ? '저장 중…' : '↓ 이미지 저장'}
          </button>
        </div>
        {loading && <div className="period-progress active" />}
      </section>

      <div className="section-info">
        <span className="info-icon">i</span>
        <span>
          매달 종목별 <b>1등</b>을 달성으로 집계합니다 · 중도 입사자는 그 달 달성 대상에서 제외 ·
          좌수왕은 목표 150 이상만 달성 판정 · 조회 월에 활동한 인원만 표시
        </span>
      </div>

      <DataState loading={loading} error={error} onRetry={reload} />

      {!loading && !error && (
        <div className="yl-rank-grid" ref={captureRef}>
          {SECTIONS.map((s) => (
            <div className="card" key={s.key}>
              <div className="card-head">
                <div>
                  <h2>{s.title}</h2>
                  <p>누적 {targetMonth}개월 기준</p>
                </div>
              </div>
              <RankTable rows={result[s.key]} hasName={s.hasName} targetMonth={targetMonth} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RankTable({ rows, hasName, targetMonth }) {
  if (!rows.length) {
    return <div className="chart-empty"><div className="chart-empty-ic">📭</div>해당 월에 활성화된 데이터가 없습니다.</div>;
  }
  const muyeokMonth = targetMonth === UNRANK_MONTH_NO;

  return (
    <div className="table-wrap" style={{ maxHeight: 520 }}>
      <table className="table yl-rank-table">
        <thead>
          <tr>
            <th className="center">순위</th>
            <th>매장</th>
            {hasName && <th>이름</th>}
            <th className="right">누적</th>
            <th className="right">달성</th>
            <th className="right">미달성</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const logo = storeLogo(r.storeName);
            const muyeok = muyeokMonth && isUnrankStore(r.storeName);
            return (
              <tr key={`${r.storeName}_${r.name}`} className={muyeok ? 'muyeok' : ''}>
                <td className="center"><span className={`rank-num ${r.rank <= 3 ? 'top' : ''}`}>{r.rank}</span></td>
                <td>
                  <span className="store-wrap">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" className="store-logo" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                    ) : (
                      <span className="store-logo" />
                    )}
                    <span>{r.storeName}</span>
                  </span>
                </td>
                {hasName && <td className="strong">{r.name}</td>}
                <td className="right mono">{r.totalMonths}</td>
                <td className="right mono achieve">{r.achieved}</td>
                <td className="right mono fail">{r.failed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
