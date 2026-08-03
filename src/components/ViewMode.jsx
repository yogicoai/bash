'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * 보기 모드 두 가지.
 *   nav   — 사이드바로 이동하는 일반 대시보드 (기본)
 *   popup — 한 페이지에 버튼(카드)만 두고, 누르면 전부 팝업으로 뜬다
 *
 * 내부 화면도 같은 출처라 iframe으로 띄울 수 있다.
 * 다만 사이드바가 중첩되므로 팝업으로 열 때는 ?bare=1 을 붙여 셸을 벗긴다.
 */
const KEY = 'dash.viewMode';
const ViewModeContext = createContext({ mode: 'nav', setMode: () => {}, ready: false });

export function ViewModeProvider({ children }) {
  const [mode, setModeState] = useState('nav');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'popup' || saved === 'nav') setModeState(saved);
    } catch {
      /* 저장값이 없거나 접근 불가면 기본값 */
    }
    setReady(true);
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 저장 실패해도 이번 세션에는 반영된다 */
    }
  }, []);

  return <ViewModeContext.Provider value={{ mode, setMode, ready }}>{children}</ViewModeContext.Provider>;
}

export const useViewMode = () => useContext(ViewModeContext);

/** 팝업으로 띄울 주소 — 내부 경로면 셸을 벗긴다 */
export function popupHref(href) {
  if (!href.startsWith('/')) return href;
  return href + (href.includes('?') ? '&' : '?') + 'bare=1';
}

export function ViewModeToggle() {
  const { mode, setMode } = useViewMode();
  return (
    <div className="seg" title="보기 모드">
      <button type="button" className={mode === 'nav' ? 'active' : ''} onClick={() => setMode('nav')}>
        내비게이션
      </button>
      <button type="button" className={mode === 'popup' ? 'active' : ''} onClick={() => setMode('popup')}>
        한 페이지
      </button>
    </div>
  );
}
