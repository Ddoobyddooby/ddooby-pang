import { describe, expect, it } from 'vitest';
import { findMatches } from '../../src/core/matcher';
import { decideSpecial } from '../../src/core/specials';
import { parseBoard } from '../helpers/board';

/** 보드에 그룹이 하나만 있다고 보고 그 그룹의 특수 블록을 돌려준다 */
function special(text: string, lineDirection?: 'perpendicular' | 'parallel') {
  const groups = findMatches(parseBoard(text));
  expect(groups).toHaveLength(1);
  return decideSpecial(groups[0]!, lineDirection);
}

// PLAN 4.5 테이블
describe('decideSpecial', () => {
  it.each([
    ['3I', 'R R R', undefined],
    ['4I-H → lineV', 'R R R R', 'lineV'],
    [
      '4I-V → lineH',
      `
        R
        R
        R
        R
      `,
      'lineH',
    ],
    [
      '5L → bomb',
      `
        R . .
        R . .
        R R R
      `,
      'bomb',
    ],
    [
      '5T → bomb',
      `
        R R R
        . R .
        . R .
      `,
      'bomb',
    ],
    [
      '5+ → bomb',
      `
        . R .
        R R R
        . R .
      `,
      'bomb',
    ],
    ['5I-H → color', 'R R R R R', 'color'],
    [
      '5I-V → color',
      `
        R
        R
        R
        R
        R
      `,
      'color',
    ],
    [
      '6 (L 4+3) → super',
      `
        R . . .
        R . . .
        R R R R
      `,
      'super',
    ],
    ['6I → super', 'R R R R R R', 'super'],
    [
      '7 (5I 포함) → super (6+가 우선)',
      `
        R . . . .
        R . . . .
        R R R R R
      `,
      'super',
    ],
  ])('%s', (_name, board, expected) => {
    expect(special(board)).toBe(expected);
  });

  it("lineDirection 'parallel'이면 매치 방향과 같은 줄", () => {
    expect(special('R R R R', 'parallel')).toBe('lineH');
    expect(special('R\nR\nR\nR', 'parallel')).toBe('lineV');
  });
});
