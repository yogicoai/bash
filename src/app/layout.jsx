import './globals.css';
import './yleague.css';
import AppFrame from '@/components/AppFrame';

export const metadata = {
  title: '요기보 통합 대시보드',
  description: '오프라인·영업·온라인·마케팅·B2B·CS 대시보드 단일 진입점',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
