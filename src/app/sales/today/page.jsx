import PageShell from '@/components/PageShell';
import TodaySales from './TodaySales';

export const metadata = { title: '실시간 매장별 매출 · 요기코퍼레이션' };

export default function TodaySalesPage() {
  return (
    <PageShell title="실시간 매장별 매출" desc="오늘 하루 오프라인 매장별 판매 — 이카운트 10분 주기">
      <TodaySales />
    </PageShell>
  );
}
