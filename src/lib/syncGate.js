'use client';

import { readPref, writePref } from './prefs';

/**
 * 동기화 연타 방지.
 *
 * 서버(/api/auto-sync)에도 잠금이 있지만 그건 "여러 사람이 동시에 봐도 한 번만"을
 * 위한 것이고, 이건 "한 사람이 계속 누르거나 새로고침해도 한 번만"을 위한 것이다.
 * 마지막으로 돌린 시각을 쿠키에 남겨 10분이 지나야 다시 걸리게 한다.
 *
 * 쿠키라서 탭을 닫았다 열어도, 화면을 새로 그려도 그대로 남는다.
 */
export const SYNC_COOLDOWN_MS = 10 * 60_000;

const key = (name) => `dash.sync.${name}`;

/** 마지막 실행 이후 지난 시간(ms). 기록이 없으면 Infinity */
export function sinceSync(name) {
  const raw = readPref(key(name));
  const at = Number(raw);
  if (!at || Number.isNaN(at)) return Infinity;
  const gap = Date.now() - at;
  return gap < 0 ? Infinity : gap; // 시계가 뒤로 간 경우
}

export const canSync = (name) => sinceSync(name) >= SYNC_COOLDOWN_MS;

/** 남은 대기 시간(분). 지금 가능하면 0 */
export function waitMinutes(name) {
  const left = SYNC_COOLDOWN_MS - sinceSync(name);
  return left > 0 ? Math.max(1, Math.ceil(left / 60_000)) : 0;
}

export function markSync(name) {
  writePref(key(name), String(Date.now()));
}
