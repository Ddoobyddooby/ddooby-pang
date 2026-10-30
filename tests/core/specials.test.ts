import { describe, expect, it } from 'vitest';
import { findMatches } from '../../src/core/matcher';
import { blastArea, chainActivate, decideSpecial, specialPosition } from '../../src/core/specials';
import type { Board, Pos } from '../../src/core/types';
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

/** 빈 보드 (발동 범위는 칸 위치만 본다) */
function emptyBoard(rows: number, cols: number): Board {
  return { rows, cols, cells: new Array(rows * cols).fill(null), nextId: 1 };
}

/** 칸 목록을 보드 크기의 그림으로: 범위 x, 나머지 . */
function mask(board: Board, cells: readonly Pos[]): string {
  const rows = Array.from({ length: board.rows }, () => new Array(board.cols).fill('.'));
  for (const { r, c } of cells) rows[r]![c] = 'x';
  return rows.map((row) => row.join(' ')).join('\n');
}

function picture(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

// PLAN 4.5 발동 범위
describe('blastArea', () => {
  const p = (r: number, c: number): Pos => ({ r, c });
  const board = emptyBoard(5, 5);

  it.each([
    [
      'lineH: 행 전체',
      'lineH' as const,
      p(1, 2),
      `
        . . . . .
        x x x x x
        . . . . .
        . . . . .
        . . . . .
      `,
    ],
    [
      'lineV: 열 전체',
      'lineV' as const,
      p(1, 2),
      `
        . . x . .
        . . x . .
        . . x . .
        . . x . .
        . . x . .
      `,
    ],
    [
      'bomb: 3x3',
      'bomb' as const,
      p(2, 2),
      `
        . . . . .
        . x x x .
        . x x x .
        . x x x .
        . . . . .
      `,
    ],
    [
      'bomb: 모서리에서 잘림',
      'bomb' as const,
      p(0, 0),
      `
        x x . . .
        x x . . .
        . . . . .
        . . . . .
        . . . . .
      `,
    ],
    [
      'bomb: 가장자리에서 잘림',
      'bomb' as const,
      p(0, 2),
      `
        . x x x .
        . x x x .
        . . . . .
        . . . . .
        . . . . .
      `,
    ],
    [
      'super: 모서리 (5x5 잘림 + 십자)',
      'super' as const,
      p(0, 0),
      `
        x x x x x
        x x x . .
        x x x . .
        x . . . .
        x . . . .
      `,
    ],
  ])('%s', (_name, kind, at, expected) => {
    expect(mask(board, blastArea(kind, at, board))).toBe(picture(expected));
  });

  it('super: 가운데 (7x7 보드에서 5x5 + 행·열)', () => {
    const big = emptyBoard(7, 7);
    expect(mask(big, blastArea('super', p(3, 3), big))).toBe(
      picture(`
        . . . x . . .
        . x x x x x .
        . x x x x x .
        x x x x x x x
        . x x x x x .
        . x x x x x .
        . . . x . . .
      `),
    );
  });

  const colorBoard = parseBoard(`
    R Y C
    Y R- G
    R B Y
  `);

  it('color: 대상 색 전체 (특수 블록 포함) + 자기 칸', () => {
    expect(mask(colorBoard, blastArea('color', p(0, 2), colorBoard, 0))).toBe(
      picture(`
        x . x
        . x .
        x . .
      `),
    );
  });

  it('color: 대상 색이 null이면 보드 전체', () => {
    expect(blastArea('color', p(0, 2), colorBoard, null)).toHaveLength(9);
  });

  it('결과는 행 우선 정렬, 중복 없음', () => {
    const area = blastArea('super', p(2, 2), board);
    const keys = area.map(({ r, c }) => r * 5 + c);
    expect(keys).toEqual([...new Set(keys)].sort((a, b) => a - b));
  });
});

// PLAN 4.5 연쇄 발동
describe('chainActivate', () => {
  const p = (r: number, c: number): Pos => ({ r, c });

  /** activate 이벤트 요약: "종류@r,c" */
  function chain(text: string, start: Pos[]) {
    const board = parseBoard(text);
    const result = chainActivate(board, start);
    return {
      activated: result.activations.map((a) => `${a.special}@${a.at.r},${a.at.c}`),
      cleared: mask(board, result.cleared),
    };
  }

  it('특수 블록이 없으면 시작 칸만 (발동 없음)', () => {
    expect(
      chain(
        `
          R R R
          Y G B
        `,
        [p(0, 2), p(0, 0), p(0, 1)],
      ),
    ).toEqual({
      activated: [],
      cleared: picture(`
        x x x
        . . .
      `),
    });
  });

  it('시작 칸의 특수 블록이 발동해 범위가 더해진다', () => {
    expect(
      chain(
        `
          R R R| Y
          Y G B  G
          G B Y  B
        `,
        [p(0, 0), p(0, 1), p(0, 2)],
      ),
    ).toEqual({
      activated: ['lineV@0,2'],
      cleared: picture(`
        x x x .
        . . x .
        . . x .
      `),
    });
  });

  it('범위 밖의 특수 블록은 발동하지 않는다', () => {
    expect(
      chain(
        `
          R  R R- Y
          Y  G B  G
          G* B Y  B
          B  Y G  R
        `,
        [p(0, 0), p(0, 1), p(0, 2)],
      ),
    ).toEqual({
      activated: ['lineH@0,2'],
      cleared: picture(`
        x x x x
        . . . .
        . . . .
        . . . .
      `),
    });
  });

  it('줄 → 줄 → 폭탄으로 이어진다', () => {
    expect(
      chain(
        `
          R  R R- B|
          Y  G B  G
          G  B Y  B
          B  Y G  R*
        `,
        [p(0, 0), p(0, 1), p(0, 2)],
      ),
    ).toEqual({
      activated: ['lineH@0,2', 'lineV@0,3', 'bomb@3,3'],
      cleared: picture(`
        x x x x
        . . . x
        . . x x
        . . x x
      `),
    });
  });

  it('같은 블록은 한 번만 발동 (서로를 범위에 넣는 두 줄)', () => {
    const result = chainActivate(
      parseBoard(`
        R- Y G B-
        Y  G B Y
      `),
      [p(0, 0)],
    );
    expect(result.activations.map((a) => a.at)).toEqual([p(0, 0), p(0, 3)]);
  });

  it('activate 이벤트의 cleared는 그 블록의 발동 범위', () => {
    const board = parseBoard(`
      R* Y G
      Y  G B
      G  B Y
    `);
    const [activation] = chainActivate(board, [p(0, 0)]).activations;
    expect(activation).toEqual({
      type: 'activate',
      special: 'bomb',
      at: p(0, 0),
      cleared: blastArea('bomb', p(0, 0), board),
    });
  });

  it('휘말린 컬러 블록은 보드에서 가장 많은 색을 지운다', () => {
    expect(
      chain(
        `
          R- C Y
          Y  G Y
          B  Y G
        `,
        [p(0, 0)],
      ),
    ).toEqual({
      activated: ['lineH@0,0', 'color@0,1'],
      cleared: picture(`
        x x x
        x . x
        . x .
      `),
    });
  });

  it('가장 많은 색이 동점이면 번호가 작은 색 (R=0)', () => {
    expect(
      chain(
        `
          R- C Y
          G  R Y
        `,
        [p(0, 0)],
      ).cleared,
    ).toBe(
      picture(`
        x x x
        . x .
      `),
    );
  });
});
