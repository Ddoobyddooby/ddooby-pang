// 한 step의 연쇄 발동을 차례로 재생하기 위한 시간표 (PLAN 6.13). Phaser 없는 순수 함수.
import type { GameEvent } from '../../core/types';

type ActivateEvent = Extract<GameEvent, { type: 'activate' }>;

/** 발동 연출(빛줄기·링·소리)을 시작할 시각 (ms) */
export function activateDelay(event: ActivateEvent, chainStep: number): number {
  return event.depth * chainStep;
}

/** 휘말린 특수 블록이 번쩍이기 시작할 시각 (ms). 차례 0(매치·스왑으로 바로 발동)은 번쩍이지 않아 null */
export function flashDelay(event: ActivateEvent, chainStep: number): number | null {
  return event.depth > 0 ? (event.depth - 1) * chainStep : null;
}

/**
 * remove 이벤트의 블록 id → 제거를 시작할 시각 (ms).
 * - 매치 그룹 칸: 0 (일반 매치는 지금처럼 바로)
 * - 휘말린 특수 블록 자신: 자기 차례 (번쩍인 뒤 발동하면서 터진다)
 * - 나머지: 그 칸을 덮은 발동 중 가장 이른 차례 (앞 차례가 지운 칸은 다시 지우지 않는다)
 * 어느 발동에도 없는 칸은 0
 */
export function removeDelays(step: readonly GameEvent[], chainStep: number): Map<number, number> {
  const key = (p: { r: number; c: number }) => `${p.r},${p.c}`;
  const at = new Map<string, number>();
  const earliest = (k: string, ms: number) => at.set(k, Math.min(at.get(k) ?? ms, ms));

  const activations = step.filter((e): e is ActivateEvent => e.type === 'activate');
  for (const e of activations) {
    const ms = activateDelay(e, chainStep);
    for (const p of e.cleared) earliest(key(p), ms);
  }
  // 휘말린 블록은 앞 차례 범위에 들어 있어도 자기 차례까지 남아 있다
  for (const e of activations) {
    if (e.depth > 0) at.set(key(e.at), activateDelay(e, chainStep));
  }
  for (const e of step) {
    if (e.type === 'match') for (const g of e.groups) for (const p of g.cells) at.set(key(p), 0);
  }

  const out = new Map<number, number>();
  for (const e of step) {
    if (e.type === 'remove') for (const b of e.blocks) out.set(b.id, at.get(key(b.at)) ?? 0);
  }
  return out;
}
