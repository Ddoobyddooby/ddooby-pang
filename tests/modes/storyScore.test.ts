import { describe, expect, it } from 'vitest';
import { SCORE } from '../../src/config';
import { movesLeftBonus, starsFor } from '../../src/modes/storyScore';

const STARS = [3000, 6000, 9000] as const;

describe('modes/storyScore (PLAN 5절)', () => {
  it('starsFor: stars[i] 이상인 개수. 경계값(같은 점수)은 포함', () => {
    expect(starsFor(3000, STARS, true)).toBe(1);
    expect(starsFor(5999, STARS, true)).toBe(1);
    expect(starsFor(6000, STARS, true)).toBe(2);
    expect(starsFor(9000, STARS, true)).toBe(3);
    expect(starsFor(99999, STARS, true)).toBe(3);
  });

  it('starsFor: 클리어했는데 s1 미만이어도 1개', () => {
    expect(starsFor(0, STARS, true)).toBe(1);
    expect(starsFor(2999, STARS, true)).toBe(1);
  });

  it('starsFor: 실패면 점수가 높아도 0개', () => {
    expect(starsFor(99999, STARS, false)).toBe(0);
    expect(starsFor(0, STARS, false)).toBe(0);
  });

  it('movesLeftBonus: 남은 이동 × SCORE.movesLeftBonus', () => {
    expect(SCORE.movesLeftBonus).toBe(300);
    expect(movesLeftBonus(0)).toBe(0);
    expect(movesLeftBonus(1)).toBe(300);
    expect(movesLeftBonus(3)).toBe(900);
  });
});
