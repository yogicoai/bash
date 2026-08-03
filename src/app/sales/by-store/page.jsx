import PageShell from '@/components/PageShell';
import SalesDashboard from '@/components/sales/SalesDashboard';

export const metadata = { title: '매장별 판매분석 · 요기보 통합 대시보드' };

export default function SalesByStorePage() {
  return (
    <PageShell title="매장별 판매분석">
      <SalesDashboard variantKey="byStore" />
    </PageShell>
  );
}
