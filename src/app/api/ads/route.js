import { ZONES } from '@/lib/zones';

/**
 * 오늘 광고 성과 — 광고 통합(mkt-sage)에서 가져온다.
 *
 * 브라우저가 직접 부르면 CORS 에 막히므로 dash 서버가 대신 부른다.
 *
 * ⚠ 플랫폼이 주는 "전환매출"은 쓰지 않는다. 매체마다 같은 주문을 서로 자기
 *   실적으로 잡아 실제 매출보다 훨씬 크게 나온다(8/3 기준 전환매출 합계
 *   2,022만원 vs 그날 자사몰 매출 685만원). 믿을 수 있는 건 실제로 나간
 *   광고비와 잔액이다.
 */
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export async function GET(req) {
  const date = new URL(req.url).searchParams.get('date') || todayKST().replace(/-/g, '');
  const base = String(ZONES.ads || '').replace(/\/+$/, '');

  let json;
  try {
    const res = await fetch(`${base}/api/summary?date=${date}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`광고 통합 → ${res.status}`);
    json = await res.json();
  } catch (err) {
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }

  const rows = (json?.rows || []).map((r) => ({
    platform: r.platform,
    spend: Number(r.spend || 0),
    conversions: Number(r.conversions || 0),
    balance: Number(r.balance || 0),
  }));

  return Response.json(
    {
      success: true,
      date: json?.date || date,
      spend: rows.reduce((a, r) => a + r.spend, 0),
      conversions: rows.reduce((a, r) => a + r.conversions, 0),
      // 돌고 있는데 잔액이 없는 매체 — 광고가 멈출 수 있어 바로 알아야 한다
      empty: rows.filter((r) => r.spend > 0 && r.balance === 0).map((r) => r.platform),
      rows: rows.filter((r) => r.spend > 0).sort((a, b) => b.spend - a.spend),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
