'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { EmbedProvider } from './EmbedModal';

/** 로그인 화면은 사이드바 없이 단독으로 띄운다 */
export default function AppFrame({ children }) {
  const pathname = usePathname();
  if (pathname === '/login') return children;

  return (
    <EmbedProvider>
      <div className="app">
        <Sidebar />
        <div className="app-main">{children}</div>
      </div>
    </EmbedProvider>
  );
}
