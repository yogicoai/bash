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
 *
 * 월 목표도 같이 내려준다(targets-online). api/target 은 자사몰·스마트스토어 둘만 주는데
 * 온라인 매출에는 쿠팡·오늘의집·롯데홈쇼핑 등 외부몰이 다 들어가므로, 목표도 전체 몰로
 * 더해야 실적과 기준이 맞는다(2곳 1.98억 vs 전체 16곳 2.52억).
 */
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export async function GET(req) {
  const token = String(process.env.EXPORT_TOKEN || '').trim();
  if (!token) {
    return Response.json({ success: false, error: 'dash 에 EXPORT_TOKEN 이 없습니다' }, { status: 500 });
  }

  const today = todayKST();
  const month = new URL(req.url).searchParams.get('month') || today.slice(0, 7);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const start = `${month}-01`;
  const end = month === today.slice(0, 7) ? today : `${month}-${lastDay}`;

  const exportGet = async (dataset, from, to) => {
    const url = new URL(`${upstreamBase('on')}/api/export`);
    url.searchParams.set('dataset', dataset);
    url.searchParams.set('start', from);
    url.searchParams.set('end', to);
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(45_000),
    });
    if (res.status === 401) {
      throw new Error('EXPORT_TOKEN 이 onlineData 값과 다릅니다 (양쪽을 같은 값으로 맞추고 각각 Redeploy)');
    }
    if (!res.ok) throw new Error(`export(${dataset}) → ${res.status}`);
    const json = await res.json();
    return json?.rows || json?.data || (Array.isArray(json) ? json : []);
  };

  let rows;
  let targetRows = [];
  try {
    // 목표는 그 달 전체 구간으로 — 실적 구간(어제까지)과 달리 월 단위 값이다
    [rows, targetRows] = await Promise.all([
      exportGet('sales-online', start, end),
      exportGet('targets-online', `${month}-01`, `${month}-${lastDay}`).catch(() => []),
    ]);
  } catch (err) {
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }

  // 몰별 월 목표 — 0 인 몰도 목록에는 남긴다(설정이 비었는지 보이게)
  const targets = targetRows
    .filter((r) => String(r.month || '').slice(0, 7) === month)
    .map((r) => ({ name: r.mall || r.name || '미지정', target: Number(r.target || 0) }))
    .sort((a, b) => b.target - a.target);
  const targetTotal = targets.reduce((a, t) => a + t.target, 0);

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
    {
      success: true,
      month, start, end,
      lines: rows.length,
      total: daily.reduce((a, d) => a + d.sales, 0),
      daily,
      targetTotal,
      targets,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
