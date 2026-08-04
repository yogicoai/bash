'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Sidebar from './Sidebar';
import { EmbedProvider } from './EmbedModal';
import { ViewModeProvider, useViewMode } from './ViewMode';

function Frame({ children }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { mode } = useViewMode();

  // 팝업(iframe) 안에서 열릴 때는 셸 없이 화면만
  if (params.get('bare') === '1') return <div className="bare">{children}</div>;

  // 한 페이지 모드에서는 홈만 쓰므로 사이드바를 감춘다
  const hideSidebar = mode === 'popup' && pathname === '/';

  return (
    <div className={`app ${hideSidebar ? 'app-solo' : ''}`}>
      {!hideSidebar && <Sidebar />}
      <div className="app-main">{children}</div>
    </div>
  );
}

export default function AppFrame({ children, initialMode }) {
  const pathname = usePathname();
  if (pathname === '/login') return children;

  return (
    <ViewModeProvider initialMode={initialMode}>
      <EmbedProvider>
        <Suspense fallback={<div className="app"><div className="app-main">{children}</div></div>}>
          <Frame>{children}</Frame>
        </Suspense>
      </EmbedProvider>
    </ViewModeProvider>
  );
}
