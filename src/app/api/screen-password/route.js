/**
 * 화면별 비밀번호 조회.
 *
 * dash 로그인을 통과한 사람에게만 내려준다(미들웨어가 이미 막고 있다).
 * 값은 SCREEN_PASSWORDS 환경변수에만 두고 클라이언트 번들에는 넣지 않는다.
 *
 *   SCREEN_PASSWORDS=offline-admin:1234, store-staff:5678
 *   (키는 links.js 의 slug)
 */
function table() {
  const raw = process.env.SCREEN_PASSWORDS || '';
  const map = {};
  for (const entry of raw.split(/[\n,]+/)) {
    const s = entry.trim();
    if (!s) continue;
    const i = s.indexOf(':');
    if (i < 1) continue;
    map[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return map;
}

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get('slug');
  const pw = slug ? table()[slug] : null;
  return Response.json({ success: true, password: pw || null });
}

export const dynamic = 'force-dynamic';
