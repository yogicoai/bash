import PageShell from '@/components/PageShell';
import DataExport from './DataExport';

export const metadata = { title: '데이터 · 요기보 통합 대시보드' };

export default function DataPage() {
  return (
    <PageShell title="데이터" desc="원장 내려받기 · Claude(MCP) 연결">
      <DataExport />
    </PageShell>
  );
}
