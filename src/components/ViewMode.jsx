'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_MODE, VIEW_KEY, normalizeMode, readPref, writePref } from '@/lib/prefs';

/**
 * 보기 모드 두 가지.
 *   popup — 한 페이지에 버튼(카드)만 두고, 누르면 전부 팝업으로 뜬다 (기본)
 *   nav   — 사이드바로 이동하는 일반 대시보드
 *
 * 내부 화면도 같은 출처라 iframe으로 띄울 수 있다.
 * 다만 사이드바가 중첩되므로 팝업으로 열 때는 ?bare=1 을 붙여 셸을 벗긴다.
 *
 * 처음 들어오면 "한 페이지"로 보인다. 한 번 고르면 그 선택이 이 브라우저에 남아,
 * 다음에 들어올 때도 그대로 열린다.
 *
 * 선택은 쿠키에 담아 서버가 첫 HTML 을 그릴 때 이미 알고 있게 한다 —
 * 그래서 initialMode 로 시작한다. localStorage 였을 때는 한 페이지가 잠깐
 * 보였다가 내비게이션으로 바뀌었다.
 */
const ViewModeContext = createContext({ mode: DEFAULT_MODE, setMode: () => {}, ready: false });

export function ViewModeProvider({ children, initialMode }) {
  const [mode, setModeState] = useState(() => normalizeMode(initialMode));
  const [ready, setReady] = useState(false);

  // 쿠키로 옮기기 전에 localStorage 에 골라둔 사람들을 한 번만 넘겨받는다.
  useEffect(() => {
    if (!readPref(VIEW_KEY)) {
      let saved = null;
      try {
        saved = localStorage.getItem(VIEW_KEY);
      } catch {
        /* 접근 불가면 기본값 */
      }
      if (saved === 'popup' || saved === 'nav') {
        setModeState(saved);
        writePref(VIEW_KEY, saved);
      }
    }
    setReady(true);
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    writePref(VIEW_KEY, next);
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
