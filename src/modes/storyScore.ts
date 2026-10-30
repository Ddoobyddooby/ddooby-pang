// 스토리 클리어 점수 계산 (SPEC 3.2, PLAN 5절). 순수 함수라 따로 테스트한다.

import { SCORE } from '../config';

/** 클리어 시 남은 이동 1회당 보너스 */
export function movesLeftBonus(movesLeft: number): number {
  return Math.max(0, movesLeft) * SCORE.movesLeftBonus;
}

/** 최종 점수(보너스 포함)가 thresholds[i] 이상인 개수. 클리어하면 최소 1개, 실패는 0개 */
export function starsFor(
  score: number,
  thresholds: readonly [number, number, number],
  cleared: boolean,
): 0 | 1 | 2 | 3 {
  if (!cleared) return 0;
  const reached = thresholds.filter((t) => score >= t).length;
  return Math.max(1, reached) as 1 | 2 | 3;
}
