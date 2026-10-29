// 처리 루프 (PLAN 4.3): 스왑 → 매치 → 제거 → 낙하 → 리필 → (연쇄 반복) → 수 없으면 셔플
// 1주차 범위: 특수 블록(W2-05), 컬러 블록 스왑(W2-06), 점수(W2-08)는 아직 없다.

import { BOARD } from '../config';
import { getBlock, indexOf, inBounds, isAdjacent, swapBlocks } from './board';
import { applyGravity, refill } from './gravity';
import { findMatches } from './matcher';
import { createPlayableBoard, hasAnyMove, shuffle } from './moves';
import { createRng } from './rng';
import type { Board, GameEvent, GameState, Pos, ResolveResult } from './types';

const COLOR_COUNT = 6;

/** 게임 시작 상태. 같은 seed면 항상 같은 보드 (SPEC 6절 seed, 10절 수용 기준) */
export function createInitialState(options: {
  rows: number;
  cols: number;
  colors: number;
  seed: number;
}): GameState {
  const [board, rngState] = createPlayableBoard(
    options.rows,
    options.cols,
    options.colors,
    createRng(options.seed),
  );
  return { board, rngState, colors: options.colors };
}

function invalid(state: GameState, steps: GameEvent[][]): ResolveResult {
  return {
    state,
    steps,
    scoreDelta: 0,
    removedByColor: new Array(COLOR_COUNT).fill(0),
    valid: false,
  };
}

/** resolve가 끝난 보드는 빈칸 0, 매치 0, 가능한 수 ≥ 1 이어야 한다 (PLAN 10절) */
function assertInvariants(board: Board): void {
  if (board.cells.some((b) => b === null)) throw new Error('resolve 후 빈칸이 남았다');
  if (findMatches(board).length > 0) throw new Error('resolve 후 매치가 남았다');
  if (!hasAnyMove(board)) throw new Error('resolve 후 가능한 수가 없다');
}

export function resolveSwap(state: GameState, a: Pos, b: Pos): ResolveResult {
  const start = state.board;
  if (!inBounds(start, a) || !inBounds(start, b) || !isAdjacent(a, b)) return invalid(state, []);
  if (!getBlock(start, a) || !getBlock(start, b)) return invalid(state, []);

  let board = swapBlocks(start, a, b);
  let groups = findMatches(board);
  if (groups.length === 0) {
    return invalid(state, [[{ type: 'swap', a, b }], [{ type: 'swapBack', a, b }]]);
  }

  let rng = state.rngState;
  const steps: GameEvent[][] = [[{ type: 'swap', a, b }]];
  const removedByColor = new Array<number>(COLOR_COUNT).fill(0);

  for (let cascade = 0; groups.length > 0; cascade++) {
    if (cascade >= BOARD.maxCascade) {
      throw new Error(`연쇄가 ${BOARD.maxCascade}회를 넘었다 (무한 연쇄 의심)`);
    }

    // 제거 (그룹끼리는 칸을 공유하지 않지만 안전하게 중복 제거)
    const cells = board.cells.slice();
    const removed: { id: number; at: Pos; bySpecial: boolean }[] = [];
    for (const group of groups) {
      for (const at of group.cells) {
        const i = indexOf(board, at);
        const block = cells[i];
        if (!block) continue;
        removed.push({ id: block.id, at, bySpecial: false });
        if (block.color !== null) removedByColor[block.color]!++;
        cells[i] = null;
      }
    }
    board = { ...board, cells };
    steps.push([
      { type: 'match', groups, cascade },
      { type: 'remove', blocks: removed },
    ]);

    // 낙하 + 리필은 동시에 재생한다
    const fallen = applyGravity(board);
    const filled = refill(fallen.board, state.colors, rng);
    board = filled.board;
    rng = filled.rng;
    steps.push([fallen.event, filled.event]);

    groups = findMatches(board);
  }

  if (!hasAnyMove(board)) {
    const shuffled = shuffle(board, state.colors, rng);
    board = shuffled.board;
    rng = shuffled.rng;
    steps.push([shuffled.event]);
  }

  assertInvariants(board);
  return {
    state: { ...state, board, rngState: rng },
    steps,
    scoreDelta: 0, // W2-08 scoring.ts에서 계산
    removedByColor,
    valid: true,
  };
}
