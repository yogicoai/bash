import { NextResponse } from 'next/server';
import { COOKIE_NAME, MAX_AGE_SEC, RENEW_BEFORE_SEC, cookieOptions, sign, verify } from '@/lib/session';

/** 로그인 없이 열리는 경로 */
const PUBLIC = ['/login', '/api/auth/login'];

/*
 * 읽기 전용 API 토큰 (2026-10-22, 점검 요청 6번) — 로그인 없이 대시보드 요약 데이터를 GET 으로만 가져가게 한다.
 *   DASH_API_TOKENS = "이름:토큰, 이름:토큰, …"   (onlineData 의 개인 토큰과 같은 값을 써도 된다, 24자 이상)
 *   열어 주는 것은 아래 요약 경로의 GET 뿐이다. 화면 비밀번호(screen-password)·조회 때 동기화를 누르는 auto-sync·
 *   오프라인 원본 프록시(off·rt, 고객 정보가 섞일 수 있다)·로그인 관련은 토큰으로 못 연다 — 로그인으로만.
 *   토큰 값은 해시로만 비교하고, 로그에는 이름만 남긴다.
 */
const TOKEN_READ_PATHS = ['/api/alerts', '/api/online-daily', '/api/targets', '/api/seats', '/api/ads'];
const enc = new TextEncoder();
const sha256hex = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
let apiTokens = null; // [{ name, hash }] — 처음 쓸 때 한 번 만든다
async function apiTokenUser(req) {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get('authorization') || '').trim());
  if (!m) return null;
  if (!apiTokens) {
    const rows = String(process.env.DASH_API_TOKENS || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    apiTokens = (await Promise.all(rows.map(async (s) => {
      const [name, token] = s.split(':').map((x) => (x || '').trim());
      return name && token && token.length >= 24 ? { name, hash: await sha256hex(token) } : null;
    }))).filter(Boolean);
  }
  if (!apiTokens.length) return null;
  const h = await sha256hex(m[1].trim());
  return apiTokens.find((t) => t.hash === h)?.name || null;
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // 읽기 전용 API 토큰 — 요약 경로의 GET 만. 토큰을 보냈는데 틀리면 로그인으로 넘기지 않고 바로 401
  if (req.headers.get('authorization')) {
    const readable = req.method === 'GET' && TOKEN_READ_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
    const who = readable ? await apiTokenUser(req) : null;
    if (who) {
      console.log(`[dash api] ${who} → ${pathname}`);
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: readable ? '토큰이 맞지 않습니다' : '이 경로는 토큰으로 열 수 없습니다 — 조회용 요약 경로만 됩니다' },
        { status: readable ? 401 : 403 },
      );
    }
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
  // 가려던 주소를 쿼리까지 기억한다 — 공유 링크 /?daily=1(일일 모니터링 펼쳐 열기)이 로그인 뒤에도 살아 있게
  const back = pathname + req.nextUrl.search;
  url.search = back === '/' ? '' : `?next=${encodeURIComponent(back)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 이미지·아이콘 같은 정적 파일은 게이트에서 빼둔다.
  // 로그인 화면의 로고도 이 경로로 오는데, 막아 두면 로그인 전에는 이미지 요청이
  // /login 으로 튕겨 로고가 깨진 채로 보인다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)'],
};
