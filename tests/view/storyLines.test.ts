import { describe, expect, it } from 'vitest';
import { goalLine, isMovesLow, storyLines } from '../../src/view/storyLines';

const score = (current: number, target: number) => ({
  goal: { type: 'score', target } as const,
  current,
  done: current >= target,
});
const collect = (color: 0 | 1 | 2 | 3 | 4 | 5, current: number, count: number) => ({
  goal: { type: 'collect', color, count } as const,
  current,
  done: current >= count,
});

describe('goalLine', () => {
  it('점수 미션: 천 단위 콤마', () => {
    expect(goalLine(score(1200, 2000))).toEqual({
      color: null,
      text: '점수 1,200 / 2,000',
      done: false,
    });
  });

  it('수집 미션: 색과 `현재 / 목표`', () => {
    expect(goalLine(collect(0, 12, 25))).toEqual({ color: 0, text: '12 / 25', done: false });
  });

  it('목표를 넘어도 목표까지만 보여 주고 달성으로 본다', () => {
    expect(goalLine(collect(1, 30, 25))).toEqual({ color: 1, text: '25 / 25', done: true });
    expect(goalLine(score(2500, 2000)).text).toBe('점수 2,000 / 2,000');
  });
});

describe('storyLines', () => {
  it('점수 미션이 있으면 점수 줄을 따로 두지 않는다', () => {
    const r = storyLines([score(100, 900), collect(0, 1, 10)], 100, 2);
    expect(r.goals).toHaveLength(2);
    expect(r.scoreText).toBeNull();
  });

  it('점수 미션이 없으면 마지막에 `점수 N` 줄', () => {
    const r = storyLines([collect(0, 0, 15), collect(3, 0, 15)], 1200, 2);
    expect(r.scoreText).toBe('점수 1,200');
  });

  it('미션 줄은 maxLines까지만', () => {
    expect(storyLines([score(0, 1), collect(0, 0, 1), collect(1, 0, 1)], 0, 2).goals).toHaveLength(
      2,
    );
  });
});

describe('isMovesLow', () => {
  it('기준 이하(0 포함)면 true', () => {
    expect(isMovesLow(6, 5)).toBe(false);
    expect(isMovesLow(5, 5)).toBe(true);
    expect(isMovesLow(0, 5)).toBe(true);
  });
});
