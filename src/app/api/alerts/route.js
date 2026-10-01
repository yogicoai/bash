import { upstreamBase } from '@/lib/upstream';

/**
 * 오늘 챙길 것 — onlineData 경보 스캔 서버사이드 프록시.
 *
 * onlineData /api/export/alerts 가 어제(완성일) 기준으로 9가지를 한 번에 점검한다(2026-10-01 좌수 급감·퍼널 전환율 급락 추가).
 *   매출 급락(온+오프, 전주 동요일比) · 광고 이상 · 자사몰 트래픽 급락 · 미답변 문의 ·
 *   재고 소진 임박 · 월 목표 페이스(온라인·오프라인 매장) · 스토어 반품/취소율 급등
 * 원천 여러 곳을 도는 무거운 조회라 onlineData 쪽에서 10분 캐시한다(fresh=1 이면 다시 스캔).
 * 토큰(EXPORT_TOKEN)은 서버에서만 읽는다 — online-daily 와 같은 방식.
 */
export async function GET(req) {
  const token = String(process.env.EXPORT_TOKEN || '').trim();
  if (!token) {
    return Response.json({ success: false, error: 'dash 에 EXPORT_TOKEN 이 없습니다' }, { status: 500 });
  }

  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
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
    return Response.json({ success: true, ...json }, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
