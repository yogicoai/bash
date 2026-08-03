import YLeagueStatus from '@/components/yleague/YLeagueStatus';

export const metadata = { title: 'Y리그 현황 · 요기코퍼레이션' };

// 원본 화면이 자체 헤더(다크바 + 탭)를 갖고 있어 PageShell을 쓰지 않는다
export default function YLeagueStatusPage() {
  return (
    <main className="shell">
      <YLeagueStatus />
    </main>
  );
}
