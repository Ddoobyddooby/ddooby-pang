// 가능한 수 탐색, 셔플, 플레이 가능한 보드 생성 (PLAN 4.7)

import { BOARD } from '../config';
import { createBoard, getBlock, swapBlocks } from './board';
import { findMatches, MIN_RUN } from './matcher';
import { nextInt, type RngState } from './rng';
import type { Block, Board, GameEvent, Pos } from './types';

type ShuffleEvent = Extract<GameEvent, { type: 'shuffle' }>;

function isColorBomb(block: Block | null): boolean {
  return block?.special === 'color';
}

/** pos를 지나는 가로 또는 세로 run이 MIN_RUN 이상인가 */
function hasMatchThrough(board: Board, pos: Pos): boolean {
  const color = getBlock(board, pos)?.color;
  if (color == null) return false;
  const same = (r: number, c: number) => getBlock(board, { r, c })?.color === color;
  const count = (dr: number, dc: number) => {
    let n = 0;
    for (let r = pos.r + dr, c = pos.c + dc; same(r, c); r += dr, c += dc) n++;
    return n;
  };
  return 1 + count(0, -1) + count(0, 1) >= MIN_RUN || 1 + count(-1, 0) + count(1, 0) >= MIN_RUN;
}

/** a와 b를 바꾸면 유효한 수인가 (매치가 생기거나, 컬러 블록이 끼어 있다) */
export function isValidSwap(board: Board, a: Pos, b: Pos): boolean {
  if (isColorBomb(getBlock(board, a)) || isColorBomb(getBlock(board, b))) return true;
  const swapped = swapBlocks(board, a, b);
  return hasMatchThrough(swapped, a) || hasMatchThrough(swapped, b);
}

/** 왼쪽 위부터 오른쪽·아래 이웃과의 스왑을 시험해 첫 번째 유효한 수를 돌려준다 */
export function findHint(board: Board): { a: Pos; b: Pos } | null {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const a = { r, c };
      if (!getBlock(board, a)) continue;
      for (const b of [
        { r, c: c + 1 },
        { r: r + 1, c },
      ]) {
        if (getBlock(board, b) && isValidSwap(board, a, b)) return { a, b };
      }
    }
  }
  return null;
}

export function hasAnyMove(board: Board): boolean {
  return findHint(board) !== null;
}

/** 매치 0 + 가능한 수 ≥ 1 */
function isPlayable(board: Board): boolean {
  return findMatches(board).length === 0 && hasAnyMove(board);
}

/** 매치가 없고 가능한 수가 있는 보드를 만든다. 상한까지 다시 생성한다 */
export function createPlayableBoard(
  rows: number,
  cols: number,
  colors: number,
  rng: RngState,
): [board: Board, rng: RngState] {
  for (let attempt = 0; attempt < BOARD.maxGenerateAttempts; attempt++) {
    let board: Board;
    [board, rng] = createBoard(rows, cols, colors, rng);
    if (hasAnyMove(board)) return [board, rng];
  }
  throw new Error(`플레이 가능한 보드를 ${BOARD.maxGenerateAttempts}회 안에 만들지 못했다`);
}

/**
 * 블록 위치를 Fisher-Yates로 섞는다 (특수 블록 포함, 빈칸은 그대로).
 * 매치 0 + 가능한 수 ≥ 1이 될 때까지 반복하고, 상한을 넘으면 일반 블록으로 새로 만든다.
 */
export function shuffle(
  board: Board,
  colors: number,
  rng: RngState,
): { board: Board; event: ShuffleEvent; rng: RngState } {
  const slots: number[] = [];
  board.cells.forEach((b, i) => b && slots.push(i));

  for (let attempt = 0; attempt < BOARD.maxGenerateAttempts; attempt++) {
    const blocks = slots.map((i) => board.cells[i]!);
    for (let i = blocks.length - 1; i > 0; i--) {
      let j: number;
      [j, rng] = nextInt(rng, i + 1);
      [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
    }
    const cells = board.cells.slice();
    slots.forEach((slot, k) => (cells[slot] = blocks[k]!));
    const candidate: Board = { ...board, cells };
    if (isPlayable(candidate)) return { board: candidate, event: toShuffleEvent(candidate), rng };
  }

  // 상한 초과: 일반 블록으로 새 보드 (id는 이어서 발급)
  let fresh: Board;
  [fresh, rng] = createPlayableBoard(board.rows, board.cols, colors, rng);
  const cells = fresh.cells.map((b) => b && { ...b, id: board.nextId + b.id - 1 });
  const regenerated: Board = { ...board, cells, nextId: board.nextId + cells.length };
  return { board: regenerated, event: toShuffleEvent(regenerated), rng };
}

function toShuffleEvent(board: Board): ShuffleEvent {
  const mapping: { block: Block; to: Pos }[] = [];
  board.cells.forEach((block, i) => {
    if (block) mapping.push({ block, to: { r: Math.floor(i / board.cols), c: i % board.cols } });
  });
  return { type: 'shuffle', mapping };
}
