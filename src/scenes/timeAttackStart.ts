// 경쟁 시작 준비의 순수한 부분 (V2-W3-03, PLAN2 6.4). Phaser 없음, 테스트용으로 분리.

import { RUN } from '../config';
import type { GameData } from './sceneData';
import type { RunClient } from './runClient';

/**
 * 서버 seed·시간과 달라서 랭킹 대상이 될 수 없는 URL 옵션인지.
 * ?seed는 어느 빌드에서나 보드를 바꾼다. ?time·?specials는 DEV에서만 먹는다
 */
export function hasRankBlockingOption(search: string, dev: boolean): boolean {
  const params = new URLSearchParams(search);
  return params.has('seed') || (dev && (params.has('time') || params.has('specials')));
}

export type TimeAttackStart = Extract<GameData, { mode: 'timeattack' }>;

/**
 * 경쟁 시작 데이터를 정한다.
 * - 랭킹을 막는 옵션이거나 서버를 쓸 수 없는 상태(오프라인·키 없음)면 기다리지 않고 run 없이 (줄 없음)
 * - 아니면 startRun을 timeoutMs까지 기다려 run을 붙인다. null·시간 초과면 run 없이 + unranked
 */
export async function prepareTimeAttack(
  client: Pick<RunClient, 'startRun' | 'canRank'>,
  options: { blocked: boolean; timeoutMs?: number },
): Promise<TimeAttackStart> {
  if (options.blocked || !client.canRank()) return { mode: 'timeattack' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), options.timeoutMs ?? RUN.startTimeoutMs);
  });
  try {
    const run = await Promise.race([client.startRun().catch(() => null), timeout]);
    return run ? { mode: 'timeattack', run } : { mode: 'timeattack', unranked: true };
  } finally {
    clearTimeout(timer);
  }
}
