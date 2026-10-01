'use client';

import { useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { ApiError } from '@/lib/api';
import { ZONES } from '@/lib/zones';

/**
 * 오늘 챙길 것 — 이상 신호를 홈 맨 위에 먼저 보여준다(모니터링).
 *
 * 원천: onlineData 경보 스캔 (/api/export/alerts → dash /api/alerts 프록시).
 *   어제(완성일) 기준 9가지 자동 점검 — 매출 급락(온+오프) · 광고 이상 · 자사몰 트래픽 급락 · 좌수 급감 · 퍼널 전환율 급락 ·
 *   미답변 문의 · 재고 소진 임박 · 월 목표 페이스(온라인·오프라인 매장) · 스토어 반품률 급등.
 *   아래 실시간 매출 타일과 달리 "어제까지 확정된" 숫자라 라벨로 구분한다.
 * 스캔은 onlineData 가 10분 캐시한다 — 홈을 여러 번 열어도 원천 부담이 늘지 않는다.
 * 재고 판단 기준은 온라인 판매 월평균(오프라인 제외) — 기준 변경은 MD 결정 사항이라 표기만 한다.
 */
const fmt = (n) => Math.round(n || 0).toLocaleString();
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** 2026-09-29 → 9/29(화) — 보는 사람 시간대와 무관하게 */
const dayLabel = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${m}/${d}(${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
};
const pctText = (v) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—');
const timeKST = (iso) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
/** 남은 기간 — 한 달 안쪽은 일수로 (개월 소수 1자리면 재고가 남아도 "0개월"이 된다) */
const remain = (x) => {
  if (x.재고 <= 0) return '재고 0';
  if (x.남은_일 != null && x.남은_일 < 30) return x.남은_일 < 1 ? '1일 이내' : `약 ${x.남은_일}일`;
  return x.소진_개월 != null ? `${x.소진_개월}개월` : '—';
};

/** 경보 분야 → 확인할 곳 (각자 원래 쓰던 화면으로) */
const WHERE = {
  매출: { href: '/sales/today', label: '오늘 매출' },
  광고: { href: ZONES.ads, label: '광고 통합', external: true },
  트래픽: { href: ZONES.online, label: '온라인 판매분석', external: true },
  CS: { href: ZONES.cs, label: 'CS 셀프가이드', external: true },
  재고: { href: 'https://yogibo.kr/off/stock/index.html', label: '물류센터 재고', external: true },
  목표: { href: '#target-progress', label: '목표 진행' },
  반품: { href: ZONES.online, label: '온라인 판매분석', external: true },
  좌수: { href: 'https://yogibo.kr/off/y_League.html', label: 'Y리그', external: true },
  퍼널: { href: `${ZONES.online.replace(/\/$/, '')}/dashboards/funnel_daily.html`, label: '일일 퍼널 점검', external: true },
};
/** 스캔 실패 키 → 화면 이름 */
const TASK = { sales: '매출', ad: '광고', traffic: '트래픽', cs: 'CS', stock: '재고', pace: '목표', returns: '반품', jwasu: '좌수', funnel: '퍼널' };

/** dash /api/alerts 호출 — api.js get() 과 같은 규칙(401 → 로그인, success:false → 에러) */
async function fetchAlerts(fresh) {
  let res;
  try {
    res = await fetch(`/api/alerts${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다.', 0);
  }
  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new ApiError('세션이 만료되었습니다.', 401);
  }
  const json = await res.json().catch(() => null);
  if (!json) throw new ApiError(`응답을 해석할 수 없습니다. (${res.status})`, res.status);
  if (json.success === false) throw new ApiError(json.error || '경보를 불러오지 못했습니다.', res.status);
  return json;
}

function Go({ w }) {
  if (!w) return null;
  return w.external ? (
    <a className="watch-go" href={w.href} target="_blank" rel="noopener noreferrer">{w.label} →</a>
  ) : (
    <a className="watch-go" href={w.href}>{w.label} →</a>
  );
}

function Body({ d }) {
  const list = d.경보 || [];
  const bad = list.filter((a) => a.심각도 === '🔴').length;
  const y = d.어제실적 || {};
  const stock = y.재고;
  const failed = (d.스캔실패 || []).map((s) => {
    const k = String(s).split(':')[0].trim();
    return TASK[k] || k;
  });
  const tone = list.length ? (bad ? 'is-bad' : 'is-warn') : failed.length ? 'is-warn' : 'is-ok';

  return (
    <>
      <div className={`watch-summary ${tone}`}>
        {list.length ? (
          <>확인할 것 <b>{list.length}건</b>{bad ? <> · 그중 심각 <b>{bad}건</b></> : null}</>
        ) : failed.length ? (
          <>확인된 이상 신호는 없지만 {failed.join(' · ')} 항목은 점검하지 못했습니다</>
        ) : (
          <>이상 신호 없음 — 점검한 항목이 모두 정상 범위입니다</>
        )}
      </div>

      {list.length > 0 && (
        <ul className="watch-list">
          {list.map((a, i) => {
            const sev = a.심각도 === '🔴' ? 'bad' : 'warn';
            return (
              <li key={`${a.분야}-${i}`} className={`watch-item watch-${sev}`}>
                <span className="watch-sev">{sev === 'bad' ? '심각' : '주의'}</span>
                <span className="watch-area">{a.분야}</span>
                <span className="watch-text">{a.내용}</span>
                <Go w={WHERE[a.분야]} />
              </li>
            );
          })}
        </ul>
      )}

      {/* 어제 실적 한 줄 — 광고는 ROAS 대신 광고비 ÷ 온라인 매출.
          플랫폼 전환매출 ROAS 는 매체끼리 같은 주문을 중복으로 잡아 부풀려진다(HubSummary 와 같은 원칙). */}
      <div className="watch-yday">
        {y.매출 && (
          <span>
            어제 매출 <b>{fmt(y.매출.전사)}원</b> (온라인 {fmt(y.매출.온라인)} · 오프라인 {fmt(y.매출.오프라인)}) · 전주 동요일 대비 {pctText(y.매출.전주동요일比_pct)}
          </span>
        )}
        {y.트래픽 && <span>자사몰 방문 <b>{fmt(y.트래픽.방문)}명</b> · 신규 가입 {fmt(y.트래픽.신규가입)}명</span>}
        {y.광고 && (
          <span>
            광고비 <b>{fmt(y.광고.광고비)}원</b>
            {y.매출?.온라인 > 0 && <> · 온라인 매출 대비 {((y.광고.광고비 / y.매출.온라인) * 100).toFixed(1)}%</>}
          </span>
        )}
      </div>

      {stock?.급한순?.length > 0 && (
        <details className="watch-more">
          <summary>
            재고 이슈 — 발주 필요 {fmt(stock.발주필요)}품목 · 보름 내 소진 {fmt(stock.보름내소진)}품목 (급한 순 {stock.급한순.length}개)
          </summary>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>품목</th><th>색상</th><th className="right">재고</th><th className="right">월평균</th>
                  <th className="right">남은 기간</th><th className="right">제안 발주</th>
                </tr>
              </thead>
              <tbody>
                {stock.급한순.map((x, i) => (
                  <tr key={`${x.품목}-${x.색상}-${i}`}>
                    <td className="strong">{x.품목}</td>
                    <td>{x.색상 || '—'}</td>
                    <td className="right mono">{fmt(x.재고)}</td>
                    <td className="right mono">{x.월평균 ?? '—'}</td>
                    <td className="right">{remain(x)}</td>
                    <td className="right mono">{fmt(x.제안수량)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="watch-note">{stock.기준} — 발주 기준 변경은 MD 결정 사항입니다.</p>
        </details>
      )}

      {d.정상항목?.length > 0 && (
        <details className="watch-more">
          <summary>정상 항목 {d.정상항목.length}개</summary>
          <ul>{d.정상항목.map((s, i) => <li key={i}>{s}</li>)}</ul>
          {d.주의 && <p className="watch-note">{d.주의}</p>}
        </details>
      )}

      {failed.length > 0 && (
        <p className="watch-note">이번 점검에서 확인하지 못한 항목: {failed.join(', ')} — 원천 응답이 없었습니다.</p>
      )}
    </>
  );
}

export default function TodayWatch() {
  const [tick, setTick] = useState(0); // 0 = 첫 로드(캐시 허용), 1 이상 = 다시 점검
  const [cooldown, setCooldown] = useState(false);
  const data = useAsync(() => fetchAlerts(tick > 0), [tick]);
  const d = data.data;

  // 다시 점검 — 원천 여러 곳을 도는 조회라 1분 동안은 다시 누를 수 없게 한다(연타 방지)
  function rescan() {
    if (cooldown || data.loading) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 60_000);
    setTick((t) => t + 1);
  }

  return (
    <section className="watch" aria-label="오늘 챙길 것">
      <div className="watch-head">
        <strong>오늘 챙길 것</strong>
        <span className="watch-basis" title="매출·광고·트래픽·CS·재고·목표·반품·좌수·퍼널 9개 항목을 자동 점검합니다">
          {d ? `${dayLabel(d.기준일)} 기준 · 어제까지 확정` : '어제 기준'}
        </span>
        <span className="watch-tools">
          {d?.스캔시각 && (
            <span className="watch-time" title="이 시각에 점검한 결과 · 10분 동안은 같은 결과를 보여줍니다">
              {timeKST(d.스캔시각)} 점검
            </span>
          )}
          <button type="button" className="btn btn-sm" onClick={rescan} disabled={data.loading || cooldown}>
            {data.loading && d ? '점검 중…' : cooldown ? '잠시 뒤 가능' : '↻ 다시 점검'}
          </button>
        </span>
      </div>

      {data.loading && !d ? (
        <p className="watch-loading">어제 데이터 9개 항목 점검 중…</p>
      ) : data.error ? (
        <p className="watch-error">
          {data.error.message}
          <button type="button" className="btn btn-sm" onClick={data.reload}>다시 시도</button>
        </p>
      ) : d ? (
        <Body d={d} />
      ) : null}
    </section>
  );
}
