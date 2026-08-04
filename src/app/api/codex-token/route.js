/**
 * Codex 안내서가 요구하는 접속 토큰(EXPORT_TOKEN)을 알려준다.
 *
 * 이 경로는 dash 로그인 뒤에 있다(proxy 가 /api/* 를 막는다). 토큰은 서버에서만
 * 읽어 여기서 내려주므로 클라이언트 번들에는 남지 않는다.
 *
 * 값이 없으면 null 을 준다 — 화면은 "별도로 전달받은 토큰을 쓰세요"로 안내한다.
 */
export async function GET() {
  return Response.json(
    { success: true, token: process.env.EXPORT_TOKEN || null },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
