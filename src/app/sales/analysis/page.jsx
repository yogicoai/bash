import PageShell from '@/components/PageShell';
import SalesDashboard from '@/components/sales/SalesDashboard';

export const metadata = { title: '영업분석 · 요기보 통합 대시보드' };

export default function SalesAnalysisPage() {
  return (
    <PageShell title="영업분석">
      <SalesDashboard variantKey="analysis" />
    </PageShell>
  );
}
