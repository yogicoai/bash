import { upstreamBase } from '@/lib/upstream';

/**
 * 월 목표 — 사람이 입력한 값 저장소.
 *
 * ⚠ 2026-11-02 부터 목표 달성률 화면은 이 값을 쓰지 않는다. 목표는 원천(좌수 관리자
 *   매장별 월 목표 · 판매분석 채널별 월 목표)에서만 읽는다 — 같은 값이 두 곳에 있으면
 *   어긋나기 때문이다(온라인이 입력 2.52억 / 원천 1.98억 으로 갈렸다).
 *   저장된 값과 이 경로는 되돌릴 때를 위해 남겨 둔다.
 *
 * 예전에는 브라우저 localStorage 에 담아 입력한 사람 화면에만 남았다. 다른
 * 사람은 원천 기본값을 봐서 같은 회의에서 서로 다른 달성률을 보게 됐다.
 * 이제 onlineData 의 Mongo 에 저장한다. 토큰은 서버에서만 읽는다.
 */
const base = () => `${upstreamBase('on')}/api/dash-targets`;

async function call(method, url, body) {
  const token = String(process.env.EXPORT_TOKEN || '').trim();
  if (!token) throw new Error('dash 에 EXPORT_TOKEN 이 없습니다');
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new Error('EXPORT_TOKEN 이 onlineData 값과 다릅니다 (양쪽을 같은 값으로 맞추고 각각 Redeploy)');
  }
  if (!res.ok) throw new Error(json?.error || `목표 저장소 → ${res.status}`);
  return json;
}

export async function GET(req) {
  const month = new URL(req.url).searchParams.get('month') || '';
  try {
    const j = await call('GET', `${base()}?month=${encodeURIComponent(month)}`);
    return Response.json({ success: true, month, targets: j?.targets || null }, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    // 저장소가 막혀도 화면은 원천 기본값으로 돌아간다
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }
  try {
    const j = await call('POST', base(), body);
    return Response.json({ success: true, targets: j?.targets || null });
  } catch (err) {
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
