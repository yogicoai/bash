import { upstreamBase } from '@/lib/upstream';

/**
 * 오늘 챙길 것 — onlineData 경보 스캔 서버사이드 프록시.
 *
 * onlineData /api/export/alerts 가 어제(완성일) 기준으로 9가지를 한 번에 점검한다(2026-10-01 좌수 급감·퍼널 전환율 급락 추가).
 *   매출 급락(온+오프, 전주 동요일比) · 광고 이상 · 자사몰 트래픽 급락 · 미답변 문의 ·
 *   재고 소진 임박 · 월 목표 페이스(온라인·오프라인 매장) · 스토어 반품/취소율 급등
 * 여기에 팀별 심각을 얹어 내려준다(팀별심각 — 오프라인 매장 · 온라인 프로모션/진단 · 광고/실시간).
 * 전사 점검(/api/export/alerts)과 팀별 점검(/api/daily-mail 의 챙길것)은 원천이 달라, 전사만 보면
 * 일일 모니터링에 떠 있는 심각이 홈에서는 안 보였다. 두 곳을 병렬로 불러 심각만 합친다 —
 * 계산은 onlineData 가 한 그대로 쓰고 dash 는 추려서 모양만 맞춘다(같은 숫자를 두 번 계산하지 않게).
 * 원천 여러 곳을 도는 무거운 조회라 onlineData 쪽에서 10분 캐시한다(fresh=1 이면 다시 스캔).
 * 토큰(EXPORT_TOKEN)은 서버에서만 읽는다 — online-daily 와 같은 방식.
 */
/** 한국 기준 어제 — 두 점검 모두 "어제(완성일)" 기준이다 */
function yesterdayKST() {
  const k = new Date(Date.now() + 9 * 3600e3);
  const y = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - 1));
  return y.toISOString().slice(0, 10);
}

/**
 * 일일 모니터링의 팀별 점검에서 "심각"만 추려 한 모양으로 편다.
 * 분야마다 담긴 자리와 이름 칸이 달라(매장/채널/매체) 여기서 흡수한다.
 * 주의는 가져오지 않는다 — 홈은 당장 손봐야 할 것만 보여주고, 나머지는 일일 모니터링에서 본다.
 */
const TEAM_SOURCES = [
  { 팀: '오프라인', from: '오프라인', list: '매장', name: '매장', text: ['지시', '한줄'] },
  { 팀: '온라인', from: '프로모션', list: '경고', name: '채널', text: ['글'] },
  { 팀: '온라인', from: '진단', list: '항목', name: '채널', text: ['글'] },
  { 팀: '광고', from: '광고', list: '매체', name: '매체', text: ['평가'] },
  { 팀: '광고', from: '실시간', list: '항목', name: '매체', text: ['글'] },
];

function teamCritical(daily) {
  const care = daily?.챙길것;
  if (!care) return [];
  const out = [];
  for (const src of TEAM_SOURCES) {
    const block = care[src.from];
    if (!block?.ok) continue;
    for (const row of block.data?.[src.list] || []) {
      if (row?.등급 !== '심각') continue;
      const 글 = src.text.map((k) => row[k]).find(Boolean);
      if (!글) continue;
      out.push({ 팀: src.팀, 이름: row[src.name] || src.from, 글, 링크: row.링크 || null });
    }
  }
  return out;
}

export async function GET(req) {
  const token = String(process.env.EXPORT_TOKEN || '').trim();
  if (!token) {
    return Response.json({ success: false, error: 'dash 에 EXPORT_TOKEN 이 없습니다' }, { status: 500 });
  }

  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  const 기준일 = yesterdayKST();

  // 팀별 점검은 따로 도는 무거운 조회라 전사 점검과 나란히 부른다.
  // 실패해도 전사 점검은 그대로 보여야 하므로 여기서 삼킨다.
  const dailyP = fetch(`${upstreamBase('on')}/api/daily-mail?date=${기준일}`, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(50_000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  try {
    const url = new URL(`${upstreamBase('on')}/api/export/alerts`);
    if (fresh) url.searchParams.set('fresh', '1');
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(55_000),
    });
    if (res.status === 401) {
      throw new Error('EXPORT_TOKEN 이 onlineData 값과 다릅니다 (양쪽을 같은 값으로 맞추고 각각 Redeploy)');
    }
    if (res.status === 404) throw new Error('onlineData 에 경보 API 가 아직 배포되지 않았습니다');
    if (!res.ok) throw new Error(`alerts → ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '경보 스캔 실패');

    // 기준일이 어긋나면 섞지 않는다 — 다른 날 숫자가 한 줄에 같이 서면 안 된다
    const daily = await dailyP;
    const 팀별심각 = daily?.기준일 === json.기준일 ? teamCritical(daily) : [];

    return Response.json(
      { success: true, ...json, 팀별심각 },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
