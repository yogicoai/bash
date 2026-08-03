'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 라이트/다크 전환 — html 에 data-theme 을 심고 CSS 변수만 바꾼다.
 * 기본은 다크. layout 의 <html data-theme="dark"> 와 맞춰 두어
 * 첫 화면이 밝게 번쩍였다가 어두워지는 일이 없다.
 * 한 번 고르면 그 선택이 localStorage 에 남는다.
 */
const KEY = 'dash.theme';
const DEFAULT_THEME = 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    let next = null;
    try {
      next = localStorage.getItem(KEY);
    } catch {
      /* 접근 불가면 OS 설정으로 */
    }
    if (next !== 'light' && next !== 'dark') next = DEFAULT_THEME;
    setThemeState(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 저장 실패해도 이번 세션에는 반영된다 */
    }
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
