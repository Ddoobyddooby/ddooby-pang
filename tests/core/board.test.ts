import { describe, expect, it } from 'vitest';
import {
  createBoard,
  getBlock,
  indexOf,
  inBounds,
  isAdjacent,
  posOf,
  setBlock,
  swapBlocks,
} from '../../src/core/board';
import { createRng } from '../../src/core/rng';
import type { Board } from '../../src/core/types';
import { parseBoard, printBoard } from '../helpers/board';

/** matcher(W1-09)와 독립적인 단순 검사: 가로·세로 같은 색 3연속이 있는가 */
function hasThreeInARow(board: Board): boolean {
  const color = (r: number, c: number) => getBlock(board, { r, c })?.color;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const k = color(r, c);
      if (k == null) continue;
      if (k === color(r, c + 1) && k === color(r, c + 2)) return true;
      if (k === color(r + 1, c) && k === color(r + 2, c)) return true;
    }
  }
  return false;
}

describe('createBoard', () => {
  it('8x8, id 1~64, nextId 65', () => {
    const [board] = createBoard(8, 8, 5, createRng(1));
    expect(board.rows).toBe(8);
    expect(board.cols).toBe(8);
    expect(board.cells.map((b) => b!.id)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
    expect(board.nextId).toBe(65);
  });

  it('색은 0 ~ colors-1 범위이고 빈칸이 없다', () => {
    const [board] = createBoard(8, 8, 4, createRng(2));
    for (const b of board.cells) {
      expect(b).not.toBeNull();
      expect(b!.color).toBeGreaterThanOrEqual(0);
      expect(b!.color).toBeLessThan(4);
    }
  });

  it.each([3, 4, 5, 6])('colors=%i, seed 1~200 모두 시작 매치 0', (colors) => {
    for (let seed = 1; seed <= 200; seed++) {
      const [board] = createBoard(8, 8, colors, createRng(seed));
      expect(hasThreeInARow(board), `seed ${seed}\n${printBoard(board)}`).toBe(false);
    }
  });

  it('같은 seed → 같은 보드, 다른 seed → 다른 보드', () => {
    const [a, rngA] = createBoard(8, 8, 5, createRng(1001));
    const [b, rngB] = createBoard(8, 8, 5, createRng(1001));
    const [c] = createBoard(8, 8, 5, createRng(1002));
    expect(a).toEqual(b);
    expect(rngA).toBe(rngB);
    expect(printBoard(a)).not.toBe(printBoard(c));
  });

  it('colors가 3~6이 아니면 에러', () => {
    expect(() => createBoard(8, 8, 2, createRng(1))).toThrow(RangeError);
    expect(() => createBoard(8, 8, 7, createRng(1))).toThrow(RangeError);
  });
});

describe('조회 / 수정', () => {
  const board = parseBoard(`
    R Y G
    B P O
  `);

  it('index ↔ pos', () => {
    expect(indexOf(board, { r: 1, c: 2 })).toBe(5);
    expect(posOf(board, 5)).toEqual({ r: 1, c: 2 });
  });

  it('inBounds / getBlock: 보드 밖은 null', () => {
    expect(inBounds(board, { r: 1, c: 2 })).toBe(true);
    expect(inBounds(board, { r: 2, c: 0 })).toBe(false);
    expect(inBounds(board, { r: 0, c: -1 })).toBe(false);
    expect(getBlock(board, { r: 1, c: 0 })?.color).toBe(3);
    expect(getBlock(board, { r: -1, c: 0 })).toBeNull();
  });

  it('setBlock은 새 보드를 돌려주고 원본을 바꾸지 않는다', () => {
    const next = setBlock(board, { r: 0, c: 0 }, null);
    expect(printBoard(next)).toBe('.  Y  G\nB  P  O');
    expect(printBoard(board)).toBe('R  Y  G\nB  P  O');
    expect(() => setBlock(board, { r: 5, c: 0 }, null)).toThrow(RangeError);
  });

  it('swapBlocks는 두 칸을 바꾸고 원본을 바꾸지 않는다', () => {
    const next = swapBlocks(board, { r: 0, c: 0 }, { r: 1, c: 0 });
    expect(printBoard(next)).toBe('B  Y  G\nR  P  O');
    expect(getBlock(next, { r: 1, c: 0 })?.id).toBe(1);
    expect(printBoard(board)).toBe('R  Y  G\nB  P  O');
  });

  it('isAdjacent: 상하좌우 한 칸만 true', () => {
    const o = { r: 3, c: 3 };
    expect(isAdjacent(o, { r: 2, c: 3 })).toBe(true);
    expect(isAdjacent(o, { r: 4, c: 3 })).toBe(true);
    expect(isAdjacent(o, { r: 3, c: 2 })).toBe(true);
    expect(isAdjacent(o, { r: 3, c: 4 })).toBe(true);
    expect(isAdjacent(o, { r: 4, c: 4 })).toBe(false); // 대각선
    expect(isAdjacent(o, { r: 3, c: 5 })).toBe(false); // 두 칸
    expect(isAdjacent(o, o)).toBe(false); // 같은 칸
  });
});
