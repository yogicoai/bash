'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_KEY, normalizeTheme, readPref, writePref } from '@/lib/prefs';

/**
 * 라이트/다크 전환 — html 에 data-theme 을 심고 CSS 변수만 바꾼다.
 * 기본은 다크. 고른 값은 쿠키에 담아 layout 이 서버에서 <html data-theme> 에
 * 미리 심는다 — 그래서 라이트를 골라둔 사람도 첫 화면이 어두웠다가 밝아지지 않는다.
 */

export function useTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    let next = readPref(THEME_KEY);
    if (!next) {
      // 쿠키로 옮기기 전에 골라둔 사람 — 한 번만 넘겨받는다
      try {
        next = localStorage.getItem(THEME_KEY);
      } catch {
        /* 접근 불가면 기본값 */
      }
      if (next === 'light' || next === 'dark') writePref(THEME_KEY, next);
    }
    next = normalizeTheme(next);
    setThemeState(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    writePref(THEME_KEY, next);
  }, []);

  return { theme, setTheme };
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className="btn btn-sm theme-toggle"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? '라이트 모드로' : '다크 모드로'}
    >
      {theme === 'dark' ? '☀️ 라이트' : '🌙 다크'}
    </button>
  );
}
