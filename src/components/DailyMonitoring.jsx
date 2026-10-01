'use client';

import { useEffect, useState } from 'react';
import { ZONES } from '@/lib/zones';

/**
 * 일일 모니터링 — 홈 맨 위, 접힌 상태로 둔다. 누르면 아래로 펼쳐져 전날 데이터를 자세히 본다.
 *
 * 화면은 onlineData 의 일일 모니터링 페이지(/dashboards/daily_mail.html — 매일 캡처해 메일로 보내는 바로 그 화면)를
 * iframe 으로 넣는다. 다른 독립 앱처럼 dash 가 다시 만들지 않는다(같은 숫자를 두 곳에서 계산하지 않게).
 *   · 처음 펼칠 때 불러온다 — 홈을 열 때마다 무거운 페이지를 부르지 않게. 한 번 펼친 뒤엔 접어도 유지.
 *   · 페이지가 postMessage 로 알려 주는 높이에 iframe 을 맞춘다 — 안쪽 스크롤 없이 통째로 보인다.
 *   · ?daily=1 또는 #daily 로 들어오면 펼친 채로 연다(메일 본문 "웹에서 보기" 링크).
 */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** 한국 기준 어제 → 9/30(수) — 페이지 기본 기준일(어제)과 같다 */
function yesterdayLabel() {
  const k = new Date(Date.now() + 9 * 3600e3);
  const y = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - 1));
  return `${y.getUTCMonth() + 1}/${y.getUTCDate()}(${DOW[y.getUTCDay()]})`;
}
const SRC = `${ZONES.online.replace(/\/$/, '')}/dashboards/daily_mail.html`;
const ORIGIN = (() => { try { return new URL(SRC).origin; } catch { return null; } })();

export default function DailyMonitoring() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState(1400);
  const [label, setLabel] = useState('');

  useEffect(() => {
    setLabel(yesterdayLabel()); // 서버 렌더와 날짜가 어긋나지 않게 브라우저에서
    const p = new URLSearchParams(window.location.search);
    if (p.get('daily') === '1' || window.location.hash === '#daily') { setOpen(true); setLoaded(true); }
    const onMsg = (e) => {
      if (ORIGIN && e.origin !== ORIGIN) return; // 일일 모니터링 페이지가 보낸 높이만
      const d = e.data || {};
      if (d.type === 'yogibo-daily-mail:height' && d.height > 0) setHeight(Math.ceil(d.height) + 4);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function toggle() {
    setOpen((o) => !o);
    setLoaded(true);
  }

  return (
    <section id="daily" className={`dm${open ? ' dm-open' : ''}`} aria-label="일일 모니터링">
      <button type="button" className="dm-head" onClick={toggle} aria-expanded={open}>
        <span className="dm-title">📊 일일 모니터링</span>
        <span className="dm-basis">{label ? `${label} 기준` : '어제 기준'} · 전날 데이터</span>
        <span className="dm-sub">매출·목표 대비 · KPI·광고 · 좌수 · 재고 — 매일 메일로 나가는 화면</span>
        <span className="dm-toggle">{open ? '접기 ▲' : '펼쳐 보기 ▼'}</span>
      </button>
      <div className="dm-body" style={{ maxHeight: open ? height + 60 : 0 }}>
        {loaded && <iframe className="dm-frame" src={SRC} title="일일 모니터링" style={{ height }} />}
        <div className="dm-foot">
          <a href={SRC} target="_blank" rel="noopener noreferrer">새 창으로 크게 보기 ↗</a>
        </div>
      </div>
    </section>
  );
}
