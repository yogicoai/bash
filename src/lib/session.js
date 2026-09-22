/**
 * 세션 쿠키 — HMAC-SHA256 서명 토큰.
 *
 * Web Crypto만 사용하므로 Edge(middleware)와 Node(route handler) 양쪽에서 동작한다.
 * node:crypto를 쓰면 middleware에서 못 쓰기 때문에 의도적으로 subtle을 사용.
 */

export const COOKIE_NAME = 'dash_session';
/**
 * 7일 — 한 번 넣으면 일주일은 다시 묻지 않는다.
 * 매일 여는 화면이라 하루 단위로 비밀번호를 묻는 건 번거롭기만 했다.
 * 비밀번호 하나를 여럿이 쓰는 구조라 이보다 길게는 두지 않는다 — 기기를
 * 잃어버리거나 사람이 바뀌었을 때 일주일이면 저절로 끊긴다.
 */
export const MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * 남은 시간이 이보다 적으면 쿠키를 새로 발급한다(슬라이딩 갱신).
 * 계속 쓰는 사람은 절반(3.5일)이 지날 때마다 조용히 연장되어 끊기지 않고,
 * 일주일 동안 한 번도 안 들어온 사람만 다시 비밀번호를 넣는다.
 */
export const RENEW_BEFORE_SEC = Math.floor(MAX_AGE_SEC / 2);

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function secret() {
  const s = process.env.DASH_SESSION_SECRET;
  if (!s) throw new Error('DASH_SESSION_SECRET 미설정');
  return s;
}

async function key() {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** 서명된 세션 토큰 발급 */
export async function sign(payload) {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** 검증 통과 시 payload, 실패/만료 시 null */
export async function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await key(), b64urlDecode(sig), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload?.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 로그인 성공 시 심을 쿠키 옵션 */
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}
