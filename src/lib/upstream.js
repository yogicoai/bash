/**
 * 원천 API 프록시.
 *
 * 오프라인 대시보드가 붙는 백엔드는 두 개였다. 2026-10-19 realtime 기능을 offorder로 옮겨 지금은 둘 다 offorder다.
 *   rt   — 예전 realtime(web.js) 경로: jwasu/*, orders, months, stock, warehouse-stock … → Desktop/오프라인/realtimeRoutes.js
 *   off  — Desktop/오프라인/index.js (verify-pin, stock/snapshot/*, ordersOffData, work-hours …)
 *
 * 둘 다 라우트에 인증이 없다. 그래서 브라우저가 직접 부르지 않고
 * 반드시 이 서버사이드 프록시를 거치게 한다 — 주소가 클라이언트 번들에 안 남고,
 * 접근 통제는 dash 로그인 하나로 묶인다.
 */

const UPSTREAMS = {
  // 예전 REALTIME_API(realtime 주소)가 환경변수에 남아 있어도 offorder로 보낸다
  rt: process.env.OFFORDER_API || 'https://port-0-offorder-lzgmwhc4d9883c97.sel4.cloudtype.app',
  off: process.env.OFFORDER_API || 'https://port-0-offorder-lzgmwhc4d9883c97.sel4.cloudtype.app',
  // 온라인 판매분석(onlineData) — 홈 요약의 온라인 매출에 쓴다
  on: process.env.ONLINEDATA_API || 'https://on-iota-three.vercel.app',
};

export function upstreamBase(name) {
  const base = UPSTREAMS[name];
  if (!base) throw new Error(`알 수 없는 업스트림: ${name}`);
  return base.replace(/\/+$/, '');
}

/**
 * onlineData 는 대시보드 전체를 로그인으로 잠근다(onlineData/middleware.js).
 * dash 서버가 부르는 집계 주소는 개인 Export 토큰(EXPORT_TOKEN, 서버에서만 읽음)으로 통과한다.
 */
export function upstreamAuthHeaders(name) {
  if (name !== 'on') return {};
  const token = String(process.env.EXPORT_TOKEN || '').trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/**
 * 업스트림으로 요청을 그대로 흘려보낸다.
 * @param {'rt'|'off'} name
 * @param {string[]} segments  경로 조각 (예: ['api','warehouse-stock'])
 * @param {Request} req
 */
export async function proxy(name, segments, req) {
  const url = new URL(req.url);
  const path = segments.map(encodeURIComponent).join('/');
  const target = `${upstreamBase(name)}/${path}${url.search}`;

  const init = {
    method: req.method,
    headers: { accept: req.headers.get('accept') || 'application/json', ...upstreamAuthHeaders(name) },
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
    const ct = req.headers.get('content-type');
    if (ct) init.headers['content-type'] = ct;
  }

  let res;
  try {
    res = await fetch(target, init);
  } catch (err) {
    return Response.json(
      { success: false, error: `업스트림(${name}) 연결 실패: ${err.message}` },
      { status: 502 },
    );
  }

  // 엑셀 다운로드 등 JSON이 아닌 응답도 그대로 통과시킨다.
  const headers = new Headers();
  for (const h of ['content-type', 'content-disposition', 'content-length']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('cache-control', 'no-store');

  return new Response(res.body, { status: res.status, headers });
}
