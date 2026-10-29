import { describe, expect, it } from 'vitest';
import { createBoard, isAdjacent, swapBlocks } from '../../src/core/board';
import { findMatches } from '../../src/core/matcher';
import {
  createPlayableBoard,
  findHint,
  hasAnyMove,
  isValidSwap,
  shuffle,
} from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import type { Board } from '../../src/core/types';
import { parseBoard, printBoard } from '../helpers/board';

/** 가능한 수가 하나도 없는 8x8 보드: color = (c + 2r) % 4 */
const NO_MOVE = `
  R Y G B R Y G B
  G B R Y G B R Y
  R Y G B R Y G B
  G B R Y G B R Y
  R Y G B R Y G B
  G B R Y G B R Y
  R Y G B R Y G B
  G B R Y G B R Y
`;

/** 기준 구현: 112쌍을 전부 스왑해 보고 findMatches로 확인 */
function bruteForceHasMove(board: Board): boolean {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      for (const b of [
        { r, c: c + 1 },
        { r: r + 1, c },
      ]) {
        if (b.r >= board.rows || b.c >= board.cols) continue;
        if (findMatches(swapBlocks(board, { r, c }, b)).length > 0) return true;
      }
    }
  }
  return false;
}

function colorCounts(board: Board) {
  const counts = new Map<string, number>();
  for (const b of board.cells) {
    const key = `${b?.color}/${b?.special}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

describe('isValidSwap / findHint / hasAnyMove', () => {
  it('스왑해서 3개가 맞으면 유효', () => {
    const board = parseBoard(`
      R R Y
      G B R
    `);
    expect(isValidSwap(board, { r: 0, c: 2 }, { r: 1, c: 2 })).toBe(true);
    expect(isValidSwap(board, { r: 0, c: 0 }, { r: 1, c: 0 })).toBe(false);
  });

  it('findHint는 실제로 매치가 생기는 인접한 두 칸을 돌려준다', () => {
    const board = parseBoard(`
      Y B G
      R R B
      B Y R
    `);
    const hint = findHint(board)!;
    expect(isAdjacent(hint.a, hint.b)).toBe(true);
    expect(findMatches(swapBlocks(board, hint.a, hint.b)).length).toBeGreaterThan(0);
  });

  it('수 없는 보드 → null / false', () => {
    const board = parseBoard(NO_MOVE);
    expect(findMatches(board)).toEqual([]);
    expect(findHint(board)).toBeNull();
    expect(hasAnyMove(board)).toBe(false);
  });

  it('컬러 블록이 있으면 항상 수가 있다', () => {
    const board = parseBoard(NO_MOVE.replace('R Y G B R Y G B', 'C Y G B R Y G B'));
    expect(hasAnyMove(board)).toBe(true);
    expect(findHint(board)).toEqual({ a: { r: 0, c: 0 }, b: { r: 0, c: 1 } });
  });

  it('랜덤 보드 300개에서 기준 구현과 결과가 같다', () => {
    let rng = createRng(77);
    let withMove = 0;
    for (let i = 0; i < 300; i++) {
      let board: Board;
      [board, rng] = createBoard(8, 8, 6, rng);
      const expected = bruteForceHasMove(board);
      expect(hasAnyMove(board), printBoard(board)).toBe(expected);
      if (expected) withMove++;
    }
    expect(withMove).toBeGreaterThan(0);
  });
});

describe('shuffle', () => {
  it('수 없는 보드 → 셔플 후 매치 0 + 수 ≥ 1', () => {
    const board = parseBoard(NO_MOVE);
    const { board: next } = shuffle(board, 4, createRng(1));
    expect(findMatches(next)).toEqual([]);
    expect(hasAnyMove(next)).toBe(true);
  });

  it('블록 구성(id, 색, 특수)은 그대로고 위치만 바뀐다', () => {
    const board = parseBoard(NO_MOVE.replace('G B R Y G B R Y', 'G- B R Y G B* R Y'));
    const { board: next, event } = shuffle(board, 4, createRng(2));
    expect(next.cells.map((b) => b!.id).sort((a, b) => a - b)).toEqual(
      board.cells.map((b) => b!.id).sort((a, b) => a - b),
    );
    expect(colorCounts(next)).toEqual(colorCounts(board));
    expect(next.nextId).toBe(board.nextId);
    // 이벤트는 셔플 후 전체 배치
    expect(event.mapping).toHaveLength(64);
    for (const { block, to } of event.mapping) {
      expect(next.cells[to.r * 8 + to.c]).toEqual(block);
    }
  });

  it('같은 rng → 같은 결과', () => {
    const board = parseBoard(NO_MOVE);
    expect(shuffle(board, 4, createRng(5))).toEqual(shuffle(board, 4, createRng(5)));
  });

  it('빈칸은 제자리에 남는다', () => {
    const board = parseBoard(NO_MOVE.replace('R Y G B R Y G B', '. Y G B R Y G B'));
    const { board: next } = shuffle(board, 4, createRng(3));
    expect(next.cells[0]).toBeNull();
  });

  it('셔플로 풀 수 없으면 일반 블록으로 새로 만들고 id를 이어서 발급한다', () => {
    // 9칸 전부 같은 색: 어떻게 섞어도 매치가 생긴다
    const board = parseBoard(`
      R R R
      R R R
      R R R
    `);
    const { board: next, event } = shuffle(board, 3, createRng(4));
    expect(findMatches(next)).toEqual([]);
    expect(hasAnyMove(next)).toBe(true);
    expect(next.cells.map((b) => b!.id)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(next.nextId).toBe(19);
    expect(event.mapping.map((m) => m.block.id)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });
});

describe('createPlayableBoard', () => {
  it('seed 1~200: 매치 0 + 수 ≥ 1', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const [board] = createPlayableBoard(8, 8, 5, createRng(seed));
      expect(findMatches(board), `seed ${seed}`).toEqual([]);
      expect(hasAnyMove(board), `seed ${seed}`).toBe(true);
    }
  });
});
