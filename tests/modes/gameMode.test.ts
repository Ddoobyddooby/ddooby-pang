import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GameMode, ModeResult } from '../../src/modes/GameMode';

describe('modes/GameMode 타입 (PLAN 5절)', () => {
  it('ModeResult는 kind로 좁혀진다', () => {
    const describeResult = (r: ModeResult): string => {
      if (r.kind === 'timeattack') {
        expectTypeOf(r).toEqualTypeOf<{
          kind: 'timeattack';
          score: number;
          bestScore: number;
          newBest: boolean;
        }>();
        return `${r.score}${r.newBest ? ' 신기록' : ''}`;
      }
      expectTypeOf(r.stars).toEqualTypeOf<0 | 1 | 2 | 3>();
      expectTypeOf(r.stageId).toBeNumber();
      return r.cleared ? `클리어 ★${r.stars}` : '실패';
    };
    expect(describeResult({ kind: 'timeattack', score: 120, bestScore: 100, newBest: true })).toBe(
      '120 신기록',
    );
    expect(
      describeResult({ kind: 'story', stageId: 3, cleared: true, score: 900, bonus: 0, stars: 2 }),
    ).toBe('클리어 ★2');
  });

  it('GameMode의 메서드 시그니처', () => {
    expectTypeOf<GameMode['kind']>().toEqualTypeOf<'story' | 'timeattack'>();
    expectTypeOf<GameMode['tick']>().parameters.toEqualTypeOf<[dtMs: number]>();
    expectTypeOf<GameMode['score']>().returns.toBeNumber();
    expectTypeOf<GameMode['result']>().returns.toEqualTypeOf<ModeResult>();
  });
});
