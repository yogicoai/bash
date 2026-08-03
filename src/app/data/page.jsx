import PageShell from '@/components/PageShell';
import DataExport from './DataExport';

export const metadata = { title: '데이터 · 요기코퍼레이션' };

export default function DataPage() {
  return (
    <PageShell title="데이터" desc="원장 내려받기 · Claude(MCP) 연결">
      <DataExport />
    </PageShell>
  );
}
