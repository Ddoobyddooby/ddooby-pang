import { describe, expect, it } from 'vitest';
import { cascadeMultiplier, groupBase, stepScore } from '../../src/core/scoring';
import type { MatchGroup, Pos } from '../../src/core/types';

/** 크기만 의미 있는 그룹 (점수는 cells.length만 본다) */
function group(size: number): MatchGroup {
  const cells: Pos[] = Array.from({ length: size }, (_, c) => ({ r: 0, c }));
  return { color: 0, cells, maxRunH: size, maxRunV: 0, hasIntersection: false };
}

describe('scoring (PLAN 4.8)', () => {
  it('groupBase: 3 → 30, 4 → 120, 5 → 200, 6 → 300, 7 → 350, 8 → 400', () => {
    expect([3, 4, 5, 6, 7, 8].map(groupBase)).toEqual([30, 120, 200, 300, 350, 400]);
  });

  it('cascadeMultiplier: 0 → 1, 1 → 1.5, 2 → 2', () => {
    expect([0, 1, 2].map(cascadeMultiplier)).toEqual([1, 1.5, 2]);
  });

  it('stepScore: 그룹 점수를 더한다', () => {
    expect(stepScore([group(3), group(4)], 0, 0)).toBe(150);
  });

  it('stepScore: 특수 효과로 지운 블록은 하나에 20', () => {
    expect(stepScore([group(3)], 3, 0)).toBe(30 + 60);
  });

  it('stepScore: 연쇄 배율을 곱하고 버림한다', () => {
    expect(stepScore([group(3)], 0, 1)).toBe(45);
    expect(stepScore([group(3)], 1, 1)).toBe(75); // (30 + 20) × 1.5
  });

  it('stepScore: 컬러 스왑 발동(그룹 없음, cascade 0)은 지운 블록 × 20', () => {
    expect(stepScore([], 5, 0)).toBe(100);
  });
});
