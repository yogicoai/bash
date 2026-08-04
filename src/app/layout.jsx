import { cookies } from 'next/headers';
import './globals.css';
import AppFrame from '@/components/AppFrame';
import { THEME_KEY, VIEW_KEY, normalizeMode, normalizeTheme } from '@/lib/prefs';

export const metadata = {
  title: '요기코퍼레이션',
  description: '오프라인·영업·온라인·마케팅·B2B·CS 대시보드 단일 진입점',
};

export default async function RootLayout({ children }) {
  // 저장된 선택을 서버에서 미리 읽는다 — 첫 프레임부터 그 사람 화면으로 그린다
  const jar = await cookies();
  const theme = normalizeTheme(jar.get(THEME_KEY)?.value);
  const mode = normalizeMode(jar.get(VIEW_KEY)?.value);

  return (
    <html lang="ko" data-theme={theme}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>
        <AppFrame initialMode={mode}>{children}</AppFrame>
      </body>
    </html>
  );
}
