import { listUsers } from '@/lib/users';

/**
 * 로그인 설정 진단 — 임시.
 *
 * 배포된 서버가 실제로 어떤 계정 설정을 보고 있는지 확인한다. 화면에서는
 * "비밀번호가 맞지 않습니다" 하나뿐이라 값이 없는 건지, 다른 값이 들어간 건지,
 * 붙여넣다 공백이 딸려온 건지 구분할 수 없다.
 *
 * ⚠ 비밀번호 값 자체는 절대 내보내지 않는다 — 길이와 "모양"만 본다.
 *   원인을 잡고 나면 이 라우트는 지운다.
 */

const shape = (s) => ({
  length: s.length,
  앞뒤공백: s !== s.trim(),
  따옴표로감쌈: /^["'].*["']$/.test(s),
  줄바꿈포함: /[\r\n]/.test(s),
  // 각 글자의 종류만 — 값 자체는 복원되지 않는다
  구성: [...s]
    .map((c) => (/[a-z]/.test(c) ? 'a' : /[A-Z]/.test(c) ? 'A' : /[0-9]/.test(c) ? '9' : /\s/.test(c) ? '␣' : '#'))
    .join(''),
});

export async function GET() {
  const usersRaw = process.env.DASH_USERS;
  const legacy = process.env.DASH_PASSWORD;
  const users = listUsers();

  return Response.json(
    {
      // 어느 설정이 실제로 쓰이고 있는가 — DASH_USERS 가 있으면 DASH_PASSWORD 는 무시된다
      사용중: usersRaw && usersRaw.trim() ? 'DASH_USERS' : legacy ? 'DASH_PASSWORD' : '(없음)',
      DASH_USERS: usersRaw == null ? '(미설정)' : shape(usersRaw),
      DASH_PASSWORD: legacy == null ? '(미설정)' : shape(legacy),
      계정수: users.length,
      계정id: users.map((u) => u.id),
      세션키설정: Boolean(process.env.DASH_SESSION_SECRET),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
