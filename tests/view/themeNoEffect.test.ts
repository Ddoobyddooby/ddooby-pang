// 테마는 보기만 바꾼다 (SPEC 15절): 테마를 바꿔도 같은 seed + 같은 입력이면 점수·보드가 같다
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import type { GameState } from '../../src/core/types';
import { THEMES, setActiveTheme, type ThemeId } from '../../src/view/theme/themes';

/** 힌트(core)가 알려 주는 스왑을 20번 두고 점수와 마지막 상태를 돌려준다 */
function play(seed: number): { score: number; state: GameState } {
  let state = createInitialState({ rows: 8, cols: 8, colors: 6, seed });
  let score = 0;
  for (let turn = 0; turn < 20; turn++) {
    const move = findHint(state.board);
    if (!move) break;
    const result = resolveSwap(state, move.a, move.b);
    state = result.state;
    score += result.scoreDelta;
  }
  return { score, state };
}

describe('테마가 core 결과에 영향 없음', () => {
  afterEach(() => setActiveTheme('storybook'));

  it.each([1, 7, 42])('seed %i: 테마 4개 모두 같은 점수·같은 최종 상태', (seed) => {
    const results = THEMES.map((t) => {
      setActiveTheme(t.id as ThemeId);
      return play(seed);
    });
    expect(results[0]!.score).toBeGreaterThan(0);
    for (const r of results) expect(r).toEqual(results[0]);
  });
});
