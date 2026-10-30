// 점수 계산 (SPEC 5절, PLAN 4.8). 그룹 단위로 계산하고 연쇄 배율을 곱한다.

import { SCORE } from '../config';
import type { MatchGroup } from './types';

/** 그룹 하나의 기본 점수. 크기 = 칸 수 (L / T / + 모양도 칸 수로 센다) */
export function groupBase(size: number): number {
  if (size <= 3) return SCORE.perBlock * size;
  if (size === 4) return SCORE.match4;
  if (size === 5) return SCORE.match5;
  return SCORE.match6Base + (size - 6) * SCORE.match6Extra;
}

/** cascade는 0부터. 0 → 1배, 1 → 1.5배 … */
export function cascadeMultiplier(cascade: number): number {
  return 1 + cascade * SCORE.cascadeStep;
}

/** cascade 한 번의 점수. bySpecialCount = 그 cascade에서 특수 효과로 지워진 블록 수 */
export function stepScore(
  groups: readonly MatchGroup[],
  bySpecialCount: number,
  cascade: number,
): number {
  const base = groups.reduce((sum, g) => sum + groupBase(g.cells.length), 0);
  return Math.floor((base + bySpecialCount * SCORE.bySpecial) * cascadeMultiplier(cascade));
}
