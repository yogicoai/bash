import { upstreamBase } from '@/lib/upstream';

/**
 * 온라인 매출을 일자별로 — 오프라인과 같은 구조로 보기 위해.
 *
 * 온라인은 일자별 시리즈를 주는 조회 API 가 없다(compare/daily·daily·series 모두 404).
 * 하루씩 부르면 월말에 90번이 된다. 대신 Codex 용으로 열어 둔 export 가 이카운트
 * 온라인 원장을 날짜까지 붙여 한 번에 준다 — 오프라인의 api/orders 와 같은 성격이다.
 *
 * 원장은 상품 한 줄씩이라 크다. 브라우저로 흘리지 않고 서버에서 날짜·채널로 접는다.
 * 토큰(EXPORT_TOKEN)은 서버에서만 읽는다.
 */
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export async function GET(req) {
  const token = process.env.EXPORT_TOKEN;
  if (!token) {
    return Response.json({ success: false, error: 'EXPORT_TOKEN 미설정' }, { status: 500 });
  }

  const today = todayKST();
  const month = new URL(req.url).searchParams.get('month') || today.slice(0, 7);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const start = `${month}-01`;
  const end = month === today.slice(0, 7) ? today : `${month}-${lastDay}`;

  let rows;
  try {
    const url = new URL(`${upstreamBase('on')}/api/export`);
    url.searchParams.set('dataset', 'sales-online');
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`export → ${res.status}`);
    const json = await res.json();
    rows = json?.rows || json?.data || (Array.isArray(json) ? json : []);
  } catch (err) {
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }

  // 날짜 → 채널 → 금액. 상품까지 내려보내면 응답이 커져 채널까지만 접는다.
  const byDate = new Map();
  for (const r of rows) {
    const date = String(r.date || '').slice(0, 10);
    if (!date) continue;
    const amt = Number(r.amount || 0);
    const day = byDate.get(date) || { sales: 0, qty: 0, channels: new Map() };
    day.sales += amt;
    day.qty += Number(r.qty || 0);
    const ch = r.store || '미지정';
    day.channels.set(ch, (day.channels.get(ch) || 0) + amt);
    byDate.set(date, day);
  }

  const daily = [...byDate.entries()]
    .map(([date, v]) => ({
      date,
      sales: v.sales,
      qty: v.qty,
      channels: [...v.channels.entries()].map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return Response.json(
    { success: true, month, start, end, lines: rows.length, total: daily.reduce((a, d) => a + d.sales, 0), daily },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
