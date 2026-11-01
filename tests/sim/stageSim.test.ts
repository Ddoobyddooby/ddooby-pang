import { describe, expect, it } from 'vitest';
import type { StageDef } from '../../src/data/stageSchema';
import { measureStage, playStage, quantile } from '../../scripts/sim/stageSim';

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
