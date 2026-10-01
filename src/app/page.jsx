import DashCard from '@/components/DashCard';
import { ViewModeToggle } from '@/components/ViewMode';
import { ThemeToggle } from '@/components/Theme';
import HubSummary from '@/components/HubSummary';
import TargetProgress from '@/components/TargetProgress';
import TodayWatch from '@/components/TodayWatch';
import DailyMonitoring from '@/components/DailyMonitoring';
import { GROUPS } from '@/lib/links';

export default function HomePage() {
  // 진행률 — links.js의 status를 바꾸면 여기도 따라 움직인다.
  const inDash = GROUPS.flatMap((g) => g.items).filter((i) => i.status !== 'external');
  const done = inDash.filter((i) => i.status === 'ready').length;

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <div className="page-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="YOGI CORPORATION" className="page-logo" />
            {/* 로고가 이름을 대신하므로 화면에는 감춘다 — 읽기 프로그램·탭 제목용으로만 남긴다 */}
            <h1 className="sr-only">통합 대시보드</h1>
          </div>
          <p>오프라인·영업·온라인·마케팅·B2B·CS 데이터를 한곳에서</p>
        </div>
        <div className="actions">
          <ViewModeToggle />
          <ThemeToggle />
          <span className="badge">dash 화면 {done} / {inDash.length}</span>
        </div>
      </header>

      {/* 맨 위 — 접힌 일일 모니터링(누르면 전날 데이터 전체가 펼쳐진다 · 메일과 같은 화면) */}
      <DailyMonitoring />
      {/* 어제 기준 이상 신호를 먼저 — "오늘 챙길 것"의 목표 경보가 아래 목표 진행으로 이어진다 */}
      <TodayWatch />
      <div id="target-progress">
        <TargetProgress />
      </div>
      <HubSummary />

      {GROUPS.map((group) => (
        <section className="group" key={group.id}>
          <div className="group-head">
            <h2>
              {group.icon} {group.title}
            </h2>
            <p>{group.desc}</p>
          </div>
          <div className="grid">
            {group.items.map((item) => (
              <DashCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      ))}

      <p className="footnote">
        원천 API(realtime · offorder)는 브라우저에서 직접 호출하지 않습니다.
        모든 요청은 <code>/api/rt/*</code> · <code>/api/off/*</code> 서버사이드 프록시를 거칩니다.
      </p>
    </main>
  );
}
