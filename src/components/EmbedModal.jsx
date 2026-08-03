'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ZONE_COMMANDS, isLocal } from '@/lib/zones';

const EmbedContext = createContext({ open: () => {} });

/** 외부 화면을 팝업(iframe)으로 띄우는 컨텍스트 — 사이드바·카드 어디서든 open(item) */
export function EmbedProvider({ children }) {
  const [item, setItem] = useState(null);
  const open = useCallback((i) => setItem(i), []);
  const close = useCallback(() => setItem(null), []);

  useEffect(() => {
    if (!item) return;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    // 팝업이 떠 있는 동안 뒤쪽 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [item, close]);

  return (
    <EmbedContext.Provider value={{ open }}>
      {children}
      {item && (
        <div className="embed-overlay" onClick={close}>
          <div className="embed-modal" onClick={(e) => e.stopPropagation()}>
            <header className="embed-head">
              <div className="embed-title">
                <span className="embed-ic">{item.icon}</span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.desc}</small>
                </div>
              </div>
              <div className="actions">
                {!item.href.startsWith('/') && (
                  <span className="badge">{item.href.replace(/^https?:\/\//, '')}</span>
                )}
                <a className="btn btn-sm" href={item.href} target="_blank" rel="noopener noreferrer">
                  새 창 ↗
                </a>
                <button type="button" className="embed-close" onClick={close} aria-label="닫기">✕</button>
              </div>
            </header>
            {isLocal(item.href) && ZONE_COMMANDS[item.slug] && (
              <div className="embed-hint">
                화면이 비어 있으면 그 앱이 아직 안 떠 있는 겁니다 — <code>{ZONE_COMMANDS[item.slug]}</code>
              </div>
            )}
            <iframe className="embed-frame" src={item.href} title={item.name} />
          </div>
        </div>
      )}
    </EmbedContext.Provider>
  );
}

export const useEmbed = () => useContext(EmbedContext);
