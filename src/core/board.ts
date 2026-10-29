// 보드 생성과 조회·수정 유틸 (PLAN 4.1, 4.7). 수정 함수는 항상 새 Board를 돌려준다.

import { nextInt, type RngState } from './rng';
import type { Block, Board, Color, Pos } from './types';

export function inBounds(board: Board, { r, c }: Pos): boolean {
  return r >= 0 && r < board.rows && c >= 0 && c < board.cols;
}

export function indexOf(board: Board, { r, c }: Pos): number {
  return r * board.cols + c;
}

export function posOf(board: Board, index: number): Pos {
  return { r: Math.floor(index / board.cols), c: index % board.cols };
}

/** 보드 밖이거나 빈칸이면 null */
export function getBlock(board: Board, pos: Pos): Block | null {
  if (!inBounds(board, pos)) return null;
  return board.cells[indexOf(board, pos)] ?? null;
}

export function setBlock(board: Board, pos: Pos, block: Block | null): Board {
  if (!inBounds(board, pos)) throw new RangeError(`보드 밖 좌표: (${pos.r}, ${pos.c})`);
  const cells = board.cells.slice();
  cells[indexOf(board, pos)] = block;
  return { ...board, cells };
}

export function swapBlocks(board: Board, a: Pos, b: Pos): Board {
  const cells = board.cells.slice();
  const ia = indexOf(board, a);
  const ib = indexOf(board, b);
  [cells[ia], cells[ib]] = [cells[ib]!, cells[ia]!];
  return { ...board, cells };
}

/** 상하좌우로 한 칸 차이 */
export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.r === b.r && a.c === b.c;
}

/**
 * 매치가 없는 보드를 만든다. 왼쪽 위부터 채우며, 왼쪽 2칸 또는 위쪽 2칸과 같은 색이면 후보에서 뺀다.
 * 가능한 수가 있는지는 보장하지 않는다 (moves.ts의 createPlayableBoard가 담당).
 */
export function createBoard(
  rows: number,
  cols: number,
  colors: number,
  rng: RngState,
): [board: Board, rng: RngState] {
  if (colors < 3 || colors > 6) throw new RangeError(`colors는 3~6이어야 한다: ${colors}`);

  const cells: Block[] = [];
  const colorAt = (r: number, c: number) => cells[r * cols + c]?.color;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const banned = new Set<Color | null | undefined>();
      if (c >= 2 && colorAt(r, c - 1) === colorAt(r, c - 2)) banned.add(colorAt(r, c - 1));
      if (r >= 2 && colorAt(r - 1, c) === colorAt(r - 2, c)) banned.add(colorAt(r - 1, c));

      const candidates: Color[] = [];
      for (let k = 0; k < colors; k++) if (!banned.has(k as Color)) candidates.push(k as Color);

      let pick: number;
      [pick, rng] = nextInt(rng, candidates.length);
      cells.push({ id: cells.length + 1, color: candidates[pick]! });
    }
  }

  return [{ rows, cols, cells, nextId: cells.length + 1 }, rng];
}
