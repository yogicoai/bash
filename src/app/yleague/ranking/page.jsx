import PageShell from '@/components/PageShell';
import YLeagueRanking from '@/components/yleague/YLeagueRanking';

export const metadata = { title: 'Y리그 누적랭킹 · 요기보 통합 대시보드' };

export default function YLeagueRankingPage() {
  return (
    <PageShell title="Y리그 누적랭킹">
      <YLeagueRanking />
    </PageShell>
  );
}
