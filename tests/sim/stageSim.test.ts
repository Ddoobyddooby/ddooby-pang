import { describe, expect, it } from 'vitest';
import type { StageDef } from '../../src/data/stageSchema';
import {
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
