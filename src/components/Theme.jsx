'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 라이트/다크 전환 — html 에 data-theme 을 심고 CSS 변수만 바꾼다.
 * 선택은 localStorage 에 남고, 저장값이 없으면 OS 설정을 따른다.
 */
const KEY = 'dash.theme';

export function useTheme() {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    let next = null;
    try {
      next = localStorage.getItem(KEY);
    } catch {
      /* 접근 불가면 OS 설정으로 */
    }
    if (next !== 'light' && next !== 'dark') {
      next = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
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
