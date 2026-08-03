import PageShell from '@/components/PageShell';
import McpGuide from './DataExport';

export const metadata = { title: 'MCP 이용 안내 · 요기코퍼레이션' };

export default function DataPage() {
  return (
    <PageShell title="MCP 이용 안내" desc="Claude 채팅으로 회사 데이터를 물어보는 방법">
      <McpGuide />
    </PageShell>
  );
}
