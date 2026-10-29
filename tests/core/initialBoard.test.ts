// SPEC 10절 수용 기준: 시작 보드에 매치가 0개이고 가능한 수가 1개 이상 (seed 1~1000), 같은 seed → 같은 보드
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/core/engine';
import { findMatches } from '../../src/core/matcher';
import { hasAnyMove } from '../../src/core/moves';
import { printBoard } from '../helpers/board';

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);

describe.each([5, 6])('초기 보드 8x8, colors=%i, seed 1~1000', (colors) => {
  const make = (seed: number) => createInitialState({ rows: 8, cols: 8, colors, seed });

  it('매치 0 + 가능한 수 ≥ 1 + 빈칸 0', () => {
    for (const seed of SEEDS) {
      const { board } = make(seed);
      const where = `seed ${seed}\n${printBoard(board)}`;
      expect(findMatches(board), where).toEqual([]);
      expect(hasAnyMove(board), where).toBe(true);
      expect(
        board.cells.every((b) => b !== null),
        where,
      ).toBe(true);
    }
  });

  it('같은 seed로 두 번 만들면 완전히 같다 (보드 + rng 상태)', () => {
    for (const seed of SEEDS) {
      expect(make(seed), `seed ${seed}`).toEqual(make(seed));
    }
  });

  it('seed가 다르면 보드도 다르다 (1000개가 전부 서로 다름)', () => {
    const boards = new Set(SEEDS.map((seed) => printBoard(make(seed).board)));
    expect(boards.size).toBe(SEEDS.length);
  });
});

it('스테이지 데이터 예시(SPEC 6절 seed 1001)의 보드가 고정돼 있다', () => {
  const { board } = createInitialState({ rows: 8, cols: 8, colors: 5, seed: 1001 });
  // 보드 생성 알고리즘이 바뀌면 이 스냅샷이 깨진다 → 기존 스테이지 시작 보드가 달라졌다는 신호
  expect(printBoard(board)).toMatchSnapshot();
});
