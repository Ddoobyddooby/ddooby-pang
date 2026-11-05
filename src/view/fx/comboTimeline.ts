// 특수 블록 조합 연출의 시간표 (PLAN2 3.3). Phaser 없는 순수 함수. 값은 모두 config.ts COMBO.
import { COMBO } from '../../config';
import type { ComboKind, GameEvent } from '../../core/types';

export type ComboPhaseName = 'merge' | 'slow' | 'name';

/** combo step 안에서 차례로 재생하는 준비 연출: 모이기 → 슬로모션 → 이름 팝업 */
export function comboPhases(): { name: ComboPhaseName; ms: number }[] {
  return [
    { name: 'merge', ms: COMBO.mergeMs },
    { name: 'slow', ms: COMBO.slowMs },
    { name: 'name', ms: COMBO.nameMs },
  ];
}

/** combo step이 끝나기까지 (ms). 다음 step(remove·transform·activate)은 이 뒤에 시작한다 */
export function comboPrepMs(): number {
  return comboPhases().reduce((sum, p) => sum + p.ms, 0);
}

/** 제거 연출(파티클·흔들림·소리)을 터뜨릴 시각 (다음 step 시작 기준 ms). bombBomb은 두 번 */
export function comboBlastTimes(combo: ComboKind): number[] {
  return combo === 'bombBomb' ? [0, COMBO.bombBombSecondMs] : [0];
}

/** 이 step이 조합 준비 연출을 담고 있으면 그 이벤트 */
export function comboOf(
  step: readonly GameEvent[],
): Extract<GameEvent, { type: 'combo' }> | undefined {
  return step.find((e): e is Extract<GameEvent, { type: 'combo' }> => e.type === 'combo');
}

/** 제거 연출이 터뜨릴 칸: 다음 step의 remove 이벤트 칸 (컬러 조합은 combo.cleared가 일부뿐이라 remove를 따른다) */
export function blastCells(step: readonly GameEvent[]): { r: number; c: number }[] {
  return step.flatMap((e) => (e.type === 'remove' ? e.blocks.map((b) => b.at) : []));
}

/**
 * steps를 차례로 재생한다. 한 step이 끝나야 다음 step을 시작한다.
 * prev: 바로 앞 step (combo step 다음 step에서 제거 연출을 터뜨리는 데 쓴다)
 */
export async function runSteps(
  steps: readonly (readonly GameEvent[])[],
  playStep: (step: readonly GameEvent[], prev: readonly GameEvent[] | undefined) => Promise<void>,
): Promise<void> {
  let prev: readonly GameEvent[] | undefined;
  for (const step of steps) {
    await playStep(step, prev);
    prev = step;
  }
}
