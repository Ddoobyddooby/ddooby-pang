import { describe, expect, it } from 'vitest';
import { findMatches } from '../../src/core/matcher';
import { decideSpecial, specialPosition } from '../../src/core/specials';
import type { Pos } from '../../src/core/types';
import { parseBoard } from '../helpers/board';

/** 보드에 그룹이 하나만 있다고 보고 그 그룹을 돌려준다 */
function onlyGroup(text: string) {
  const groups = findMatches(parseBoard(text));
  expect(groups).toHaveLength(1);
  return groups[0]!;
}

function special(text: string, lineDirection?: 'perpendicular' | 'parallel') {
  return decideSpecial(onlyGroup(text), lineDirection);
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

// PLAN 4.5 생성 위치
describe('specialPosition', () => {
  const p = (r: number, c: number): Pos => ({ r, c });

  describe('첫 cascade: 스왑한 칸 중 그룹에 속한 칸', () => {
    const board = `
      Y R R R R
    `;

    it('a가 그룹에 있으면 a', () => {
      expect(specialPosition(onlyGroup(board), [p(0, 3), p(0, 4)])).toEqual(p(0, 3));
    });

    it('b가 그룹에 있으면 b', () => {
      expect(specialPosition(onlyGroup(board), [p(0, 0), p(0, 1)])).toEqual(p(0, 1));
    });
  });

  describe('이후 cascade: 무게중심에 가장 가까운 칸, 같으면 왼쪽 위', () => {
    it.each([
      ['3I 가로', 'R R R', p(0, 1)],
      ['4I 가로 (가운데 둘 중 왼쪽)', 'R R R R', p(0, 1)],
      ['4I 세로 (가운데 둘 중 위)', 'R\nR\nR\nR', p(1, 0)],
      ['5I', 'R R R R R', p(0, 2)],
      [
        '5+ → 교차점',
        `
          . R .
          R R R
          . R .
        `,
        p(1, 1),
      ],
      [
        '5T → 교차점 아래 칸',
        `
          R R R
          . R .
          . R .
        `,
        p(1, 1),
      ],
      [
        '5L (두 칸 동점 → 위쪽)',
        `
          R . .
          R . .
          R R R
        `,
        p(1, 0),
      ],
    ])('%s', (_name, board, expected) => {
      expect(specialPosition(onlyGroup(board), [])).toEqual(expected);
    });
  });

  it('스왑 칸이 그룹에 없으면 중앙 (방어 코드)', () => {
    expect(specialPosition(onlyGroup('R R R'), [p(5, 5), p(5, 6)])).toEqual(p(0, 1));
  });
});
