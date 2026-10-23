/**
 * Codex 안내서의 접속 토큰 자리 — 이제 토큰을 내려주지 않는다 (2026-10-22).
 *
 * 예전에는 dash 로그인을 통과한 누구에게나 공유 EXPORT_TOKEN 을 그대로 보여 줬다.
 * 그 값이 사내 게시글에 평문으로 올라간 일이 있어(점검 요청 3번) 토큰을 사람마다 따로 주기로 했다 —
 * 개인 토큰은 담당자가 개인 메시지로 전달하고, 화면은 "별도로 전달받은 토큰을 쓰세요"로 안내한다(token: null).
 */
export async function GET() {
  return Response.json(
    { success: true, token: null },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
