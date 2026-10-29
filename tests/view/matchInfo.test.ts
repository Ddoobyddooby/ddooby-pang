import { describe, expect, it } from 'vitest';
import type { MatchGroup } from '../../src/core/types';
import { removedFromMatch } from '../../src/view/fx/matchInfo';

const group = (color: MatchGroup['color'], cells: [number, number][]): MatchGroup => ({
  color,
  cells: cells.map(([r, c]) => ({ r, c })),
  maxRunH: 0,
  maxRunV: 0,
  hasIntersection: false,
});

describe('view/fx/matchInfo', () => {
  it('그룹 2개(빨강 3칸, 파랑 4칸) → 7칸, 각 칸의 색은 그룹 색, 순서는 그룹 순서 그대로', () => {
    const red = group(0, [
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    const blue = group(3, [
      [2, 4],
      [3, 4],
      [4, 4],
      [5, 4],
    ]);
    const removed = removedFromMatch([red, blue]);

    expect(removed).toHaveLength(7);
    expect(removed.map((cell) => cell.color)).toEqual([0, 0, 0, 3, 3, 3, 3]);
    expect(removed.map((cell) => cell.at)).toEqual([...red.cells, ...blue.cells]);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(removedFromMatch([])).toEqual([]);
  });
});
