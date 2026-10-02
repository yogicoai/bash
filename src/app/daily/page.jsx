import PageShell from '@/components/PageShell';
import DailyMonitoring from '@/components/DailyMonitoring';

export const metadata = { title: '일일 모니터링 · 요기코퍼레이션' };

// 공유·메일 링크용 전용 주소 — 홈 맨 위 일일 모니터링과 같은 화면을 펼친 채로 바로 연다.
export default function DailyPage() {
  return (
    <PageShell title="일일 모니터링" desc="전날 기준 · 매일 메일로 나가는 화면과 같습니다">
      <DailyMonitoring standalone />
    </PageShell>
  );
}
