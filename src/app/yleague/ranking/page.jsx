import YLeagueRanking from '@/components/yleague/YLeagueRanking';

export const metadata = { title: 'Y리그 누적랭킹 · 요기코퍼레이션' };

// 원본 화면이 자체 헤더를 갖고 있어 PageShell을 쓰지 않는다
export default function YLeagueRankingPage() {
  return (
    <main className="shell">
      <YLeagueRanking />
    </main>
  );
}
