/**
 * 세션 쿠키 — HMAC-SHA256 서명 토큰.
 *
 * Web Crypto만 사용하므로 Edge(middleware)와 Node(route handler) 양쪽에서 동작한다.
 * node:crypto를 쓰면 middleware에서 못 쓰기 때문에 의도적으로 subtle을 사용.
 */

export const COOKIE_NAME = 'dash_session';
export const MAX_AGE_SEC = 60 * 60 * 12; // 12시간

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
