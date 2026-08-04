import { NextResponse } from 'next/server';
import { COOKIE_NAME, MAX_AGE_SEC, RENEW_BEFORE_SEC, cookieOptions, sign, verify } from '@/lib/session';

/** 로그인 없이 열리는 경로 */
// /api/auth/diag 는 로그인 설정을 확인하기 위한 임시 경로 — 원인을 잡으면 지운다
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/diag'];

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const session = await verify(req.cookies.get(COOKIE_NAME)?.value);
  if (session) {
    // 쓰고 있는 동안에는 만료가 다가오면 조용히 연장한다 —
    // 작업 중에 로그인 화면으로 튕기는 일이 없도록.
    const left = session.exp - Math.floor(Date.now() / 1000);
    if (left < RENEW_BEFORE_SEC) {
      const res = NextResponse.next();
      const token = await sign({ u: session.u, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC });
      res.cookies.set(COOKIE_NAME, token, cookieOptions());
      return res;
    }
    return NextResponse.next();
  }

  // API는 리다이렉트 대신 401 — fetch 호출부가 HTML을 받고 파싱 실패하는 걸 막는다.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 이미지·아이콘 같은 정적 파일은 게이트에서 빼둔다.
  // 로그인 화면의 로고도 이 경로로 오는데, 막아 두면 로그인 전에는 이미지 요청이
  // /login 으로 튕겨 로고가 깨진 채로 보인다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)'],
};
