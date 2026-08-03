import { cookies } from 'next/headers';
import { COOKIE_NAME, MAX_AGE_SEC, cookieOptions, sign } from '@/lib/session';
import { listUsers, verifyUser } from '@/lib/users';

export async function POST(req) {
  if (listUsers().length === 0) {
    return Response.json({ success: false, error: 'DASH_USERS(또는 DASH_PASSWORD) 미설정' }, { status: 500 });
  }

  let id = '';
  let password = '';
  try {
    ({ id = '', password = '' } = await req.json());
  } catch {
    return Response.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }

  // 단일 비밀번호 모드에서는 아이디를 받지 않으므로 유일한 계정으로 채운다
  const users = listUsers();
  const loginId = id || (users.length === 1 ? users[0].id : '');

  const user = await verifyUser(loginId, password);
  if (!user) {
    return Response.json({ success: false, error: '아이디 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  }

  const token = await sign({ u: user.id, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, cookieOptions());

  return Response.json({ success: true, id: user.id });
}
