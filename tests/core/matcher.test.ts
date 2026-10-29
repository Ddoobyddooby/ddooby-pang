import { describe, expect, it } from 'vitest';
import { findMatches } from '../../src/core/matcher';
import type { MatchGroup } from '../../src/core/types';
import { parseBoard } from '../helpers/board';

/** 그룹 요약: 비교하기 쉽게 칸을 "r,c" 문자열로 */
function summary(g: MatchGroup) {
  return {
    color: g.color,
    size: g.cells.length,
    maxRunH: g.maxRunH,
    maxRunV: g.maxRunV,
    hasIntersection: g.hasIntersection,
    cells: g.cells.map((p) => `${p.r},${p.c}`),
  };
}

function matches(text: string) {
  return findMatches(parseBoard(text)).map(summary);
}

describe('findMatches', () => {
  it('매치가 없으면 빈 배열', () => {
    expect(
      matches(`
        R Y R Y
        Y R Y R
        R R Y Y
      `),
    ).toEqual([]);
  });

  it('3I 가로', () => {
    expect(
      matches(`
        Y R R R
        G B Y G
      `),
    ).toEqual([
      {
        color: 0,
        size: 3,
        maxRunH: 3,
        maxRunV: 0,
        hasIntersection: false,
        cells: ['0,1', '0,2', '0,3'],
      },
    ]);
  });

  it('3I 세로', () => {
    const [g] = matches(`
      Y B
      G B
      Y B
    `);
    expect(g).toMatchObject({
      color: 3,
      size: 3,
      maxRunH: 0,
      maxRunV: 3,
      cells: ['0,1', '1,1', '2,1'],
    });
  });

  it('4I 가로 / 세로', () => {
    expect(matches('G G G G Y')[0]).toMatchObject({ size: 4, maxRunH: 4, maxRunV: 0 });
    expect(
      matches(`
        P
        P
        P
        P
        Y
      `)[0],
    ).toMatchObject({ size: 4, maxRunH: 0, maxRunV: 4 });
  });

  it('5I', () => {
    expect(matches('Y O O O O O')[0]).toMatchObject({ color: 5, size: 5, maxRunH: 5 });
  });

  it('8칸 전부 한 줄', () => {
    expect(matches('R R R R R R R R')[0]).toMatchObject({ size: 8, maxRunH: 8 });
  });

  it('L 모양은 하나의 그룹 (5칸, 교차)', () => {
    expect(
      matches(`
        R Y Y
        R Y Y
        R R R
      `),
    ).toEqual([
      {
        color: 0,
        size: 5,
        maxRunH: 3,
        maxRunV: 3,
        hasIntersection: true,
        cells: ['0,0', '1,0', '2,0', '2,1', '2,2'],
      },
    ]);
  });

  it('T 모양은 하나의 그룹 (5칸, 교차)', () => {
    const result = matches(`
      G G G
      Y G Y
      Y G Y
    `);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ size: 5, maxRunH: 3, maxRunV: 3, hasIntersection: true });
  });

  it('+ 모양은 하나의 그룹 (5칸, 교차)', () => {
    const result = matches(`
      Y B Y
      B B B
      Y B Y
    `);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      size: 5,
      hasIntersection: true,
      cells: ['0,1', '1,0', '1,1', '1,2', '2,1'],
    });
  });

  it('6+ : 가로 4 + 세로 3이 한 칸을 공유 → 6칸', () => {
    const result = matches(`
      P Y G Y
      P G Y G
      P P P P
    `);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ size: 6, maxRunH: 4, maxRunV: 3, hasIntersection: true });
  });

  it('칸을 공유하지 않는 같은 색 두 run은 별개 그룹', () => {
    const result = matches(`
      R R R Y
      Y Y G G
      Y R R R
    `);
    expect(result.map((g) => g.cells)).toEqual([
      ['0,0', '0,1', '0,2'],
      ['2,1', '2,2', '2,3'],
    ]);
  });

  it('바로 붙은 평행한 두 줄도 칸을 공유하지 않으면 별개 그룹', () => {
    const result = matches(`
      R R R
      R R R
    `);
    expect(result).toHaveLength(2);
    expect(result.every((g) => g.size === 3 && !g.hasIntersection)).toBe(true);
  });

  it('서로 다른 색 그룹이 동시에', () => {
    const result = matches(`
      R R R
      B B B
    `);
    expect(result.map((g) => g.color)).toEqual([0, 3]);
  });

  it('컬러 블록은 매치에 끼지 않는다', () => {
    expect(matches('R R C R R')).toEqual([]);
    expect(matches('C C C')).toEqual([]);
  });

  it('색 있는 특수 블록은 일반 블록처럼 매치된다', () => {
    expect(matches('R R- R*')[0]).toMatchObject({ color: 0, size: 3 });
  });

  it('빈칸은 run을 끊는다', () => {
    expect(matches('R R . R R')).toEqual([]);
  });
});
