import { cookies } from 'next/headers';
import { COOKIE_NAME, MAX_AGE_SEC, cookieOptions, sign } from '@/lib/session';

/** 길이 노출을 줄이기 위한 상수시간 비교 */
function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= x.charCodeAt(i % (x.length || 1)) ^ y.charCodeAt(i % (y.length || 1));
  }
  return diff === 0;
}

export async function POST(req) {
  const expected = process.env.DASH_PASSWORD;
  if (!expected) {
    return Response.json({ success: false, error: 'DASH_PASSWORD 미설정' }, { status: 500 });
  }

  let password = '';
  try {
    ({ password } = await req.json());
  } catch {
    return Response.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }

  if (!safeEqual(password, expected)) {
    return Response.json({ success: false, error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
  }

  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const token = await sign({ u: 'yogibo', exp });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, cookieOptions());

  return Response.json({ success: true });
}
