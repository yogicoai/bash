import { NextResponse } from 'next/server';
import { COOKIE_NAME, verify } from '@/lib/session';

/** 로그인 없이 열리는 경로 */
const PUBLIC = ['/login', '/api/auth/login'];

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const session = await verify(req.cookies.get(COOKIE_NAME)?.value);
  if (session) return NextResponse.next();

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
