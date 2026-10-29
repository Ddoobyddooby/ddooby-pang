import { describe, expect, it } from 'vitest';
import { applyGravity, refill } from '../../src/core/gravity';
import { createRng } from '../../src/core/rng';
import { parseBoard, printBoard } from '../helpers/board';

describe('applyGravity', () => {
  it('한 열의 여러 빈칸: 블록이 바닥부터 쌓인다', () => {
    const board = parseBoard(`
      R
      .
      Y
      .
      .
    `);
    const { board: next, event } = applyGravity(board);
    expect(printBoard(next)).toBe(['.', '.', '.', 'R', 'Y'].join('\n'));
    expect(event.moves).toEqual([
      { id: 2, from: { r: 2, c: 0 }, to: { r: 4, c: 0 } },
      { id: 1, from: { r: 0, c: 0 }, to: { r: 3, c: 0 } },
    ]);
  });

  it('빈칸 사이에 블록이 있어도 순서를 유지하며 내려온다', () => {
    const board = parseBoard(`
      R Y
      . G
      B .
      . P
      O .
    `);
    const { board: next } = applyGravity(board);
    expect(printBoard(next)).toBe(['.  .', '.  .', 'R  Y', 'B  G', 'O  P'].join('\n'));
  });

  it('빈칸이 없으면 이동 없음, 보드도 그대로', () => {
    const board = parseBoard(`
      R Y
      G B
    `);
    const { board: next, event } = applyGravity(board);
    expect(event.moves).toEqual([]);
    expect(next.cells).toEqual(board.cells);
  });

  it('id는 보존되고 원본 보드는 바뀌지 않는다', () => {
    const board = parseBoard(`
      R
      .
    `);
    const { board: next } = applyGravity(board);
    expect(next.cells[1]?.id).toBe(1);
    expect(printBoard(board)).toBe('R\n.');
  });
});

describe('refill', () => {
  it('빈칸을 전부 채우고, 새 id는 nextId부터', () => {
    const board = parseBoard(`
      . .
      . R
      Y G
    `); // nextId = 4
    const { board: next, event } = refill(board, 5, createRng(1));
    expect(next.cells.every((b) => b !== null)).toBe(true);
    expect(event.blocks.map((b) => b.block.id)).toEqual([4, 5, 6]);
    expect(next.nextId).toBe(7);
  });

  it('dropFrom: 열의 빈칸 수만큼 위에서 떨어진다 (맨 위 = k, 맨 아래 = 1)', () => {
    const board = parseBoard(`
      . .
      . R
      . G
    `);
    const { event } = refill(board, 5, createRng(1));
    expect(event.blocks.map((b) => [b.at.r, b.at.c, b.dropFrom])).toEqual([
      [0, 0, 3],
      [1, 0, 2],
      [2, 0, 1],
      [0, 1, 1],
    ]);
  });

  it('색은 0 ~ colors-1', () => {
    const board = parseBoard(Array.from({ length: 8 }, () => '. . . . . . . .').join('\n'));
    const { event } = refill(board, 3, createRng(9));
    for (const { block } of event.blocks) {
      expect(block.color).toBeGreaterThanOrEqual(0);
      expect(block.color).toBeLessThan(3);
    }
  });

  it('같은 rng → 같은 결과, rng 상태가 진행된다', () => {
    const board = parseBoard('. . .');
    const a = refill(board, 5, createRng(7));
    const b = refill(board, 5, createRng(7));
    expect(a).toEqual(b);
    expect(a.rng).not.toBe(createRng(7));
  });

  it('낙하 → 리필 후 빈칸 0', () => {
    const board = parseBoard(`
      R . Y
      . . .
      G . .
      . B .
    `);
    const fallen = applyGravity(board).board;
    const { board: filled } = refill(fallen, 5, createRng(3));
    expect(filled.cells.filter((b) => b === null)).toHaveLength(0);
    // 원래 블록은 아래에 순서대로 남는다
    expect(filled.cells[2 * 3 + 0]?.id).toBe(1); // R
    expect(filled.cells[3 * 3 + 0]?.id).toBe(3); // G
    expect(filled.cells[3 * 3 + 1]?.id).toBe(4); // B
    expect(filled.cells[3 * 3 + 2]?.id).toBe(2); // Y
  });
});
