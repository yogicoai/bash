import PageShell from '@/components/PageShell';
import YLeagueStatus from '@/components/yleague/YLeagueStatus';

export const metadata = { title: 'Y리그 현황 · 요기보 통합 대시보드' };

export default function YLeagueStatusPage() {
  return (
    <PageShell title="Y리그 현황">
      <YLeagueStatus />
    </PageShell>
  );
}
