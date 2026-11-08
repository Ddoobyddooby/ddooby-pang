// 미션 의식 탐욕 봇 (V2-W4-01). 가능한 모든 인접 스왑을 resolveSwap으로 돌려, 첫 리필 전 결과만 보고 남은 미션에 가장 도움 되는 수를 고른다 (미리보기 없음).
// 첫 힌트 봇은 장애물을 무시해 아래쪽 장애물 미션을 거의 못 깨므로 11~30번은 이 봇으로 잰다.

import { resolveSwap } from '../../src/core/engine';
import { findHint, isValidSwap } from '../../src/core/moves';
import type { Board, Color, ObstacleKind, ResolveResult } from '../../src/core/types';
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

/** 사람이 미리 볼 수 있는 결과: 첫 refill 전까지의 제거·장애물·점수 */
export interface SeenResult {
  /** 색별 제거 수 (컬러 블록 color null은 세지 않는다) */
  byColor: number[];
  cleared: Record<ObstacleKind, number>;
  score: number;
}

/**
 * res.steps를 이벤트 순서대로 훑다가 첫 'refill'에서 멈춘다. 리필로 들어온 블록과 그 뒤 연쇄는
 * seed RNG 결과라 사람이 미리 볼 수 없으므로 뺀다 (res.scoreDelta 등 전체 합계는 쓰지 않는다).
 * remove의 색은 스왑 전 보드(before)의 id → color로 찾는다.
 */
export function seenBeforeRefill(before: Board, res: ResolveResult): SeenResult {
  const colorOf = new Map<number, Color | null>();
  for (const b of before.cells) if (b) colorOf.set(b.id, b.color);
  const seen: SeenResult = {
    byColor: [0, 0, 0, 0, 0, 0],
    cleared: { lock: 0, frost: 0, jelly: 0 },
    score: 0,
  };
  for (const step of res.steps) {
    for (const ev of step) {
      if (ev.type === 'refill') return seen;
      if (ev.type === 'remove') {
        for (const b of ev.blocks) {
          const color = colorOf.get(b.id);
          if (color !== undefined && color !== null) seen.byColor[color]!++;
        }
      } else if (ev.type === 'obstacle') {
        for (const ch of ev.changes) if (ch.hp === 0) seen.cleared[ch.kind]++;
      } else if (ev.type === 'score') {
        seen.score += ev.delta;
      }
    }
  }
  return seen;
}

/** 수의 가치 (seen = seenBeforeRefill). 이미 끝난 미션은 세지 않는다 */
export function moveValue(seen: SeenResult, progress: readonly GoalProgress[]): number {
  const w = GREEDY_WEIGHTS;
  let v = 0;
  for (const p of progress) {
    if (p.done) continue;
    const g = p.goal;
    const need = p.target - p.current;
    if (g.type === 'score') v += Math.min(need, seen.score) / w.scorePerValue;
    else if (g.type === 'collect') v += Math.min(need, seen.byColor[g.color] ?? 0) * w.collect;
    else if (g.type === 'clearJelly') v += seen.cleared.jelly * w.jelly;
    else v += Math.min(need, seen.cleared[g.obstacle]) * w.obstacle;
  }
  return v + seen.score / w.tieBreakPerScore;
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
        const value = moveValue(seenBeforeRefill(state.board, res), progress);
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
