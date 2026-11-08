import { describe, expect, it } from 'vitest';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import type { Board, ResolveResult } from '../../src/core/types';
import { StoryMode } from '../../src/modes/StoryMode';
import {
  greedyBot,
  moveValue,
  playStageGreedy,
  seenBeforeRefill,
} from '../../scripts/sim/greedyBot';
import type { Goal, StageDef } from '../../src/data/stageSchema';
import {
  firstHintBot,
  measureStage,
  obstacleLeft,
  playStage,
  quantile,
  summarizeObstacles,
} from '../../scripts/sim/stageSim';

const stage: StageDef = {
  id: 1,
  rows: 8,
  cols: 8,
  colors: 4,
  moves: 10,
  goals: [{ type: 'score', target: 500 }],
  stars: [500, 1500, 3000],
};

describe('scripts/sim/stageSim (npm run stages:sim)', () => {
  it('같은 seed → 같은 결과', () => {
    expect(playStage(stage, 7)).toEqual(playStage(stage, 7));
  });

  it('한 판은 클리어 또는 실패로 끝나고, 별은 클리어했을 때만', () => {
    const o = playStage(stage, 3);
    expect(o.cleared ? o.stars : 0).toBe(o.stars);
    if (o.cleared) expect(o.stars).toBeGreaterThanOrEqual(1);
  });

  it.each([
    [[], 0.5, 0],
    [[10], 0.8, 10],
    [[1, 2, 3, 4, 5], 0.5, 3],
    [[1, 2, 3, 4, 5], 0.8, 4],
    [[1, 2, 3, 4, 5], 1, 5],
  ])('quantile(%j, %f) → %i', (sorted, q, expected) => {
    expect(quantile(sorted, q)).toBe(expected);
  });

  it('measureStage: 비율은 0~1, 별 ≥1 ≥ 별 ≥2 ≥ 별 ≥3', () => {
    const s = measureStage(stage, [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.games).toBe(8);
    expect(s.clearRate).toBeGreaterThanOrEqual(0);
    expect(s.clearRate).toBeLessThanOrEqual(1);
    expect(s.starRates[0]).toBe(s.clearRate);
    expect(s.starRates[0]).toBeGreaterThanOrEqual(s.starRates[1]);
    expect(s.starRates[1]).toBeGreaterThanOrEqual(s.starRates[2]);
  });
});

describe('장애물 요약·남은 장애물 (stages:sim 새 열)', () => {
  it('summarizeObstacles: 종류·겹수별 칸 수', () => {
    const layers = [
      { lock: true as const },
      { lock: true as const },
      { frost: 2 as const },
      { frost: 2 as const },
      { frost: 1 as const },
      { jelly: 1 as const },
      { jelly: 2 as const },
      null,
    ];
    expect(summarizeObstacles(layers)).toBe('잠금 2·얼음 1·얼음2×2·젤리 1·젤리2×1');
  });

  it('summarizeObstacles: 장애물이 없으면 "-"', () => {
    expect(summarizeObstacles(undefined)).toBe('-');
    expect(summarizeObstacles([null, null])).toBe('-');
  });

  it('obstacleLeft: 장애물 미션만 세고, 목표를 넘으면 0', () => {
    const g = (type: string, current: number, target: number) => ({
      goal: { type },
      current,
      target,
    });
    expect(obstacleLeft([g('score', 0, 10)])).toBeUndefined();
    expect(obstacleLeft([g('score', 0, 10), g('clearJelly', 3, 8), g('clearObstacle', 9, 6)])).toBe(
      5,
    );
  });

  it('measureStage: 70%·95% 지점은 50%·80% 지점 이상이고 장애물 미션이 없으면 남은 수가 없다', () => {
    const s = measureStage(stage, [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.clearP70).toBeGreaterThanOrEqual(s.clearP50);
    expect(s.clearP95).toBeGreaterThanOrEqual(s.clearP80);
    expect(s.avgObstacleLeft).toBeUndefined();
  });
});

it('젤리 미션 판은 남은 장애물 수를 돌려주고, 평균이 나온다', () => {
  const jelly: StageDef = {
    ...stage,
    moves: 6,
    goals: [{ type: 'clearJelly' }],
    layers: Array.from({ length: 64 }, (_, i) =>
      i >= 24 && i < 40 ? { jelly: 1 as const } : null,
    ),
  };
  const o = playStage(jelly, 1);
  expect(o.obstacleLeft).toBeGreaterThanOrEqual(0);
  expect(o.obstacleLeft).toBeLessThanOrEqual(16);
  expect(o.cleared).toBe(o.obstacleLeft === 0);
  expect(measureStage(jelly, [1, 2, 3]).avgObstacleLeft).toBeGreaterThanOrEqual(0);
});

describe('탐욕 봇 (SIM_BOT=greedy)', () => {
  const jellyStage: StageDef = {
    ...stage,
    colors: 5,
    moves: 12,
    goals: [{ type: 'clearJelly' }],
    layers: Array.from({ length: 64 }, (_, i) =>
      i >= 40 && i < 48 ? { jelly: 1 as const } : null,
    ),
  };

  it('같은 seed → 같은 결과', () => {
    expect(playStageGreedy(jellyStage, 5)).toEqual(playStageGreedy(jellyStage, 5));
  });

  it('작은 젤리 판에서 첫 힌트 봇보다 남은 젤리가 평균적으로 적다', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
    const first = measureStage(jellyStage, seeds, firstHintBot);
    const greedy = measureStage(jellyStage, seeds, greedyBot);
    expect(greedy.avgObstacleLeft!).toBeLessThan(first.avgObstacleLeft!);
  });

  it('moveValue: 끝난 미션은 세지 않고, 남은 양까지만 센다', () => {
    const seen = {
      byColor: [9, 0, 0, 0, 0, 0],
      cleared: { lock: 0, frost: 0, jelly: 0 },
      score: 500,
    };
    const p = (goal: Goal, current: number, target: number) => ({
      goal,
      current,
      target,
      done: current >= target,
    });
    const collect = { type: 'collect', color: 0, count: 10 } as const;
    expect(moveValue(seen, [p(collect, 8, 10)])).toBeCloseTo(2 * 3 + 500 / 10000);
    expect(moveValue(seen, [p(collect, 10, 10)])).toBeCloseTo(500 / 10000);
  });

  it('seenBeforeRefill: 리필 뒤 연쇄로만 나오는 제거·점수는 가치에 안 들어간다', () => {
    const before = {
      rows: 1,
      cols: 3,
      nextId: 9,
      cells: [
        { id: 1, color: 0 },
        { id: 2, color: 0 },
        { id: 3, color: null },
      ],
    } as unknown as Board;
    const at = { r: 0, c: 0 };
    const res = {
      steps: [
        [
          {
            type: 'remove',
            blocks: [
              { id: 1, at, bySpecial: false },
              { id: 3, at, bySpecial: true },
            ],
          },
          {
            type: 'obstacle',
            changes: [
              { at, kind: 'jelly', hp: 0 },
              { at, kind: 'frost', hp: 1 },
            ],
          },
          { type: 'score', delta: 300, cascade: 0, at },
          { type: 'refill', blocks: [] },
        ],
        [
          { type: 'remove', blocks: [{ id: 2, at, bySpecial: false }] }, // 연쇄: 안 센다
          { type: 'obstacle', changes: [{ at, kind: 'lock', hp: 0 }] },
          { type: 'score', delta: 900, cascade: 1, at },
        ],
      ],
    } as unknown as ResolveResult;
    const seen = seenBeforeRefill(before, res);
    expect(seen.byColor).toEqual([1, 0, 0, 0, 0, 0]); // id 3(color null)과 연쇄 id 2는 제외
    expect(seen.cleared).toEqual({ lock: 0, frost: 0, jelly: 1 }); // hp 1짜리 frost, 연쇄의 lock 제외
    expect(seen.score).toBe(300);
    const collect = { type: 'collect', color: 0, count: 5 } as const;
    expect(moveValue(seen, [{ goal: collect, current: 0, target: 5, done: false }])).toBeCloseTo(
      3 + 300 / 10000,
    );
  });

  it('유효한 수가 없으면 findHint로 넘어간다', () => {
    const state = createInitialState({ rows: 8, cols: 8, colors: 4, seed: 2 });
    // 후보 스왑이 하나도 없는 1×1 판으로 알려 주면 탐욕 후보가 0개 → findHint 수를 둔다
    const res = greedyBot(state, new StoryMode(stage), { ...stage, rows: 1, cols: 1 });
    const hint = findHint(state.board)!;
    expect(res).toEqual(resolveSwap(state, hint.a, hint.b));
  });
});
