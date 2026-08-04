/**
 * 보기 모드·테마처럼 "이 브라우저에서 고른 것"을 기억하는 값들.
 *
 * localStorage 가 아니라 쿠키에 담는다. 서버가 첫 HTML 을 그릴 때 값을 알아야
 * 하기 때문이다. localStorage 는 자바스크립트가 실행된 뒤에야 읽히므로,
 * 내비게이션을 골라둔 사람도 첫 프레임에는 한 페이지가 보였다가 바뀌었다.
 */
export const VIEW_KEY = 'dash.viewMode';
export const THEME_KEY = 'dash.theme';
export const DEFAULT_MODE = 'popup';
export const DEFAULT_THEME = 'dark';

const ONE_YEAR = 60 * 60 * 24 * 365;

export const normalizeMode = (v) => (v === 'nav' || v === 'popup' ? v : DEFAULT_MODE);
export const normalizeTheme = (v) => (v === 'light' || v === 'dark' ? v : DEFAULT_THEME);

/** 이 브라우저에 기억시킨다 (httpOnly 가 아니어야 클라이언트에서도 읽힌다) */
export function writePref(key, value) {
  try {
    document.cookie = `${key}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  } catch {
    /* 쿠키를 막아둔 브라우저면 이번 세션에만 적용된다 */
  }
}

export function readPref(key) {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${key.replace('.', '\.')}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
