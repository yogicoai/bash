import { after } from 'next/server';
import { upstreamBase } from '@/lib/upstream';

/**
 * 페이지를 열 때 온라인 수집을 대신 눌러준다.
 *
 * 지금까지는 사람이 "↻ 동기화"를 눌러야만 금액이 최신이 됐다. 그런데 이 엔드포인트들은
 * 조회가 아니라 작업을 돌리는 것이라, 화면에서 그대로 자동 호출하면 보는 사람 수만큼
 * 수집이 돌아간다(오전에 열 명이 들어오면 열 번). 그래서 dash 서버가 대신 부르고
 * 여기서 잠금을 건다 — 브라우저는 이 경로만 알면 된다.
 *
 * 잠금은 두 가지다.
 *   쿨다운 — 마지막으로 돌린 지 얼마 안 됐으면 건너뛴다
 *   동시 실행 방지 — 이미 돌고 있으면 새로 시작하지 않는다
 *
 * 수집은 20초 넘게 걸리기도 한다. 그래서 "무엇을 돌릴지"만 정해 바로 응답하고,
 * 실제 작업은 after() 로 응답 뒤에 돌린다 — 화면이 응답을 기다리지 않게.
 *
 * ⚠ 서버 인스턴스마다 기억이 따로다. Vercel 처럼 인스턴스가 여럿 뜨면 쿨다운도
 *   인스턴스별로 걸리므로 최악의 경우 몇 번 더 돌 수 있다. 그래도 사람 수만큼
 *   도는 것보다는 훨씬 낫다. 아무도 안 볼 때도 최신이어야 한다면 이게 아니라
 *   onlineData 쪽 크론이 답이다.
 */

/** 마지막 실행 시각 · 진행 중인 작업 */
const last = {};
const running = {};

const COOLDOWN_MS = {
  // 자사몰 당일 매출은 계속 쌓이므로 자주. 다만 사람이 새로고침할 때마다는 아니게.
  cafe24: 10 * 60_000,
  // 스마트스토어는 밀린 날이 있을 때만 돌린다 — 굳이 자주 볼 필요가 없다.
  smartstore: 30 * 60_000,
};

const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

async function call(path, ms = 25_000) {
  const res = await fetch(`${upstreamBase('on')}/${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json().catch(() => ({}));
}

/** 지금 돌려도 되는가 — 돌릴 수 없으면 이유를 돌려준다 */
function due(key) {
  if (running[key]) return { ok: false, reason: '이미 동기화 중' };
  const since = Date.now() - (last[key] || 0);
  if (since < COOLDOWN_MS[key]) {
    return { ok: false, reason: `${Math.round((COOLDOWN_MS[key] - since) / 60_000)}분 뒤에 다시` };
  }
  return { ok: true };
}

/** 응답 뒤에 돌린다. 실패하면 시각을 남기지 않아 다음 방문에서 다시 시도한다. */
function launch(key, job) {
  last[key] = Date.now();
  running[key] = job()
    .catch(() => { last[key] = 0; })
    .finally(() => { delete running[key]; });
  return running[key];
}

export async function GET() {
  const plan = [];

  const c = due('cafe24');
  if (c.ok) plan.push('cafe24');

  // 스마트스토어는 뒤처졌을 때만 — 이미 오늘까지 반영돼 있으면 돌릴 이유가 없다.
  // 상태 조회는 금방 끝나므로 응답 전에 확인해도 된다.
  const sm = due('smartstore');
  let smReason = sm.reason;
  if (sm.ok) {
    const status = await call('api/smartstore/status', 8_000).catch(() => null);
    const to = status?.meta?.to || null;
    if (to && to >= todayKST()) smReason = '이미 최신';
    else plan.push('smartstore');
  }

  after(() => {
    if (plan.includes('cafe24')) launch('cafe24', () => call('api/refresh-today', 60_000));
    if (plan.includes('smartstore')) launch('smartstore', () => call('api/smartstore/sync-week', 60_000));
  });

  return Response.json(
    {
      success: true,
      // 응답 시점엔 아직 시작 전이다 — 화면은 이 목록을 보고 잠시 뒤에 값을 다시 읽는다
      synced: plan,
      skipped: [
        ...(c.ok ? [] : [{ key: 'cafe24', reason: c.reason }]),
        ...(plan.includes('smartstore') ? [] : [{ key: 'smartstore', reason: smReason }]),
      ],
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';

