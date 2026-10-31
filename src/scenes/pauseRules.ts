// 일시정지 규칙 (PLAN 6.6). Phaser 없는 순수 함수.

import type { GameData } from './sceneData';

export type PauseButton = 'resume' | 'retry' | 'map' | 'menu';

/** 이미 멈췄거나 게임이 끝났으면(결과로 넘어가는 중) 일시정지하지 않는다. 재생(연쇄) 중에는 된다 */
export function canPause({ finished, paused }: { finished: boolean; paused: boolean }): boolean {
  return !finished && !paused;
}

/** [계속] [다시하기] + 스토리는 [지도], 경쟁은 [메뉴] */
export function pauseButtons(from: GameData): PauseButton[] {
  return ['resume', 'retry', from.mode === 'story' ? 'map' : 'menu'];
}
