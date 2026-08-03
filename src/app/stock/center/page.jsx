import PageShell from '@/components/PageShell';
import StockCenter from './StockCenter';

export const metadata = { title: '물류센터 재고 · 요기보 통합 대시보드' };

export default function StockCenterPage() {
  return (
    <PageShell title="물류센터 재고" desc="물류센터 창고의 품목별 재고 · 분류별 조회와 일자별 스냅샷">
      <StockCenter />
    </PageShell>
  );
}
