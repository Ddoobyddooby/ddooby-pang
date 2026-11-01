// 스토리 스테이지 자동 플레이 측정 (W4-19). core + StoryMode만 쓴다 (Phaser·브라우저 없음).
// 봇은 ?demo와 같다: findHint가 찾은 첫 번째 수를 둔다. 사람보다 단순하므로 "상대적인 어려움"을 비교하는 데 쓴다.

import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import type { StageDef } from '../../src/data/stageSchema';
import { StoryMode } from '../../src/modes/StoryMode';

export interface GameOutcome {
  cleared: boolean;
  /** 최종 점수 (클리어면 남은 이동 보너스 포함) */
  score: number;
  stars: number;
}

export interface StageStats {
  id: number;
  games: number;
  clearRate: number;
  /** 모든 판의 최종 점수 중간값 */
  medianScore: number;
  /** 클리어한 판의 최종 점수 50%·80% 지점 (별 2·3 기준을 정할 때 본다) */
  clearP50: number;
  clearP80: number;
  /** 지금 stars 기준으로 별 1·2·3을 받은 비율 (전체 판 기준) */
  starRates: [number, number, number];
}

/** 한 판: 끝날 때까지 첫 번째 힌트 수를 둔다 */
export function playStage(stage: StageDef, seed: number): GameOutcome {
  let state = createInitialState({
    rows: stage.rows,
    cols: stage.cols,
    colors: stage.colors,
    seed,
  });
  const mode = new StoryMode(stage);
  while (!mode.isOver()) {
    const hint = findHint(state.board);
    if (!hint) break; // resolveSwap이 셔플까지 해 두므로 오지 않는다
    const result = resolveSwap(state, hint.a, hint.b);
    state = result.state;
    mode.onResolve(result);
  }
  const result = mode.result();
  if (result.kind !== 'story') throw new Error('스토리 결과가 아니다');
  return { cleared: result.cleared, score: result.score, stars: result.stars };
}

/** 정렬된 배열의 q 지점 (0~1). 비었으면 0 */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i]!;
}

/** seeds마다 한 판씩 */
export function measureStage(stage: StageDef, seeds: readonly number[]): StageStats {
  const outcomes = seeds.map((seed) => playStage(stage, seed));
  const all = outcomes.map((o) => o.score).sort((a, b) => a - b);
  const clears = outcomes
    .filter((o) => o.cleared)
    .map((o) => o.score)
    .sort((a, b) => a - b);
  const rate = (pred: (o: GameOutcome) => boolean) =>
    outcomes.filter(pred).length / outcomes.length;
  return {
    id: stage.id,
    games: outcomes.length,
    clearRate: clears.length / outcomes.length,
    medianScore: quantile(all, 0.5),
    clearP50: quantile(clears, 0.5),
    clearP80: quantile(clears, 0.8),
    starRates: [rate((o) => o.stars >= 1), rate((o) => o.stars >= 2), rate((o) => o.stars >= 3)],
  };
}
