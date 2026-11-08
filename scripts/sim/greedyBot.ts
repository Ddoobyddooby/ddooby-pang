// 미션 의식 탐욕 봇 (V2-W4-01). 가능한 모든 인접 스왑을 resolveSwap으로 미리 돌려, 남은 미션에 가장 도움 되는 수를 고른다.
// 첫 힌트 봇은 장애물을 무시해 아래쪽 장애물 미션을 거의 못 깨므로 11~30번은 이 봇으로 잰다.

import { resolveSwap } from '../../src/core/engine';
import { findHint, isValidSwap } from '../../src/core/moves';
import type { ResolveResult } from '../../src/core/types';
import type { GoalProgress } from '../../src/modes/StoryMode';
import { playStage, type Bot, type GameOutcome } from './stageSim';
import type { StageDef } from '../../src/data/stageSchema';

/** 수의 가치 가중치 (한곳) */
export const GREEDY_WEIGHTS = {
  /** score: min(남은, scoreDelta) / scorePerValue */
  scorePerValue: 100,
  /** collect: min(남은, 그 색 제거 수) × 이 값 */
  collect: 3,
  /** clearJelly: 이번 수로 없앤 젤리 × 이 값 */
  jelly: 10,
  /** clearObstacle: min(남은, 그 장애물 제거 수) × 이 값 */
  obstacle: 10,
  /** 동점을 가르는 가산: scoreDelta / 이 값 */
  tieBreakPerScore: 10000,
} as const;

/** 한 수의 가치. 이미 끝난 미션은 세지 않는다 */
export function moveValue(res: ResolveResult, progress: readonly GoalProgress[]): number {
  const w = GREEDY_WEIGHTS;
  let v = 0;
  for (const p of progress) {
    if (p.done) continue;
    const g = p.goal;
    const need = p.target - p.current;
    if (g.type === 'score') v += Math.min(need, res.scoreDelta) / w.scorePerValue;
    else if (g.type === 'collect')
      v += Math.min(need, res.removedByColor[g.color] ?? 0) * w.collect;
    else if (g.type === 'clearJelly') v += res.clearedObstacles.jelly * w.jelly;
    else v += Math.min(need, res.clearedObstacles[g.obstacle]) * w.obstacle;
  }
  return v + res.scoreDelta / w.tieBreakPerScore;
}

/** 가장 가치가 큰 수. 동점이면 먼저 찾은 수(행·열 순, 오른쪽 → 아래). 유효한 수가 없으면 findHint */
export const greedyBot: Bot = (state, mode, stage) => {
  const progress = mode.goalProgress();
  let best: ResolveResult | null = null;
  let bestValue = -1;
  for (let r = 0; r < stage.rows; r++) {
    for (let c = 0; c < stage.cols; c++) {
      for (const b of [
        { r, c: c + 1 },
        { r: r + 1, c },
      ]) {
        if (b.r >= stage.rows || b.c >= stage.cols) continue;
        if (!isValidSwap(state.board, { r, c }, b)) continue;
        const res = resolveSwap(state, { r, c }, b);
        if (!res.valid) continue;
        const value = moveValue(res, progress);
        if (value > bestValue) {
          bestValue = value;
          best = res;
        }
      }
    }
  }
  if (best) return best;
  const hint = findHint(state.board);
  return hint ? resolveSwap(state, hint.a, hint.b) : null;
};

export function playStageGreedy(stage: StageDef, seed: number): GameOutcome {
  return playStage(stage, seed, greedyBot);
}
