import { cookies } from 'next/headers';
import { COOKIE_NAME, MAX_AGE_SEC, cookieOptions, sign } from '@/lib/session';
import { listUsers, verifyByPassword } from '@/lib/users';

export async function POST(req) {
  if (listUsers().length === 0) {
    return Response.json({ success: false, error: 'DASH_USERS(또는 DASH_PASSWORD) 미설정' }, { status: 500 });
  }

  let password = '';
  try {
    ({ password = '' } = await req.json());
  } catch {
    return Response.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }

  // 아이디는 받지 않는다 — 비밀번호로 계정을 찾는다
  const user = await verifyByPassword(password);
  if (!user) {
    return Response.json({ success: false, error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
  }

  const token = await sign({ u: user.id, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, cookieOptions());

  return Response.json({ success: true, id: user.id });
}
