import PageShell from '@/components/PageShell';
import WarehouseStock from './WarehouseStock';

export const metadata = { title: '창고재고 · 요기보 통합 대시보드' };

export default async function WarehouseStockPage({ searchParams }) {
  const sp = await searchParams;
  // 기존 ?store= 링크(매장에 배포된 주소)와 호환 유지
  const store = typeof sp?.store === 'string' ? sp.store.trim() : '';

  return (
    <PageShell title="창고재고" wide>
      <WarehouseStock initialStore={store} />
    </PageShell>
  );
}
