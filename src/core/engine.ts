// 처리 루프 (PLAN 4.3): 스왑 → 매치 → 제거 → 낙하 → 리필 → (연쇄 반복) → 수 없으면 셔플
// 아직 없는 것: 점수(W2-08).

import { BOARD, SPECIAL } from '../config';
import { getBlock, indexOf, inBounds, isAdjacent, posOf, samePos, swapBlocks } from './board';
import { applyGravity, refill } from './gravity';
import { findMatches } from './matcher';
import { createPlayableBoard, hasAnyMove, shuffle } from './moves';
import { createRng } from './rng';
import { blastArea, chainActivate, decideSpecial, specialPosition } from './specials';
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

/** 컬러 블록 스왑 발동: at의 컬러 블록이 partner 블록의 색을 지운다. 둘 다 컬러면 보드 전체 (PLAN 4.3) */
function colorSwapBurst(board: Board, at: Pos, partner: Pos) {
  const other = getBlock(board, partner)!;
  const cleared = blastArea('color', at, board, other.color);
  const chain = chainActivate(board, cleared, other.special === 'color' ? [at, partner] : [at]);
  const first: GameEvent = { type: 'activate', special: 'color', at, cleared };
  return { cleared: chain.cleared, activations: [first, ...chain.activations] };
}

export function resolveSwap(
  state: GameState,
  a: Pos,
  b: Pos,
  newSpecialInBlast = SPECIAL.newSpecialInBlast,
): ResolveResult {
  const start = state.board;
  const idx = (p: Pos) => indexOf(start, p);
  if (!inBounds(start, a) || !inBounds(start, b) || !isAdjacent(a, b)) return invalid(state, []);
  if (!getBlock(start, a) || !getBlock(start, b)) return invalid(state, []);

  let board = swapBlocks(start, a, b);
  // 컬러 블록 스왑은 매치 없이 바로 발동한다. 둘 다 컬러면 끌어온 쪽(a의 블록, 지금 b 칸)
  let burst = [b, a].find((p) => getBlock(board, p)?.special === 'color');
  let groups = burst ? [] : findMatches(board);
  if (!burst && groups.length === 0) {
    return invalid(state, [[{ type: 'swap', a, b }], [{ type: 'swapBack', a, b }]]);
  }

  let rng = state.rngState;
  const steps: GameEvent[][] = [[{ type: 'swap', a, b }]];
  const removedByColor = new Array<number>(COLOR_COUNT).fill(0);

  for (let cascade = 0; burst || groups.length > 0; cascade++) {
    if (cascade >= BOARD.maxCascade) {
      throw new Error(`연쇄가 ${BOARD.maxCascade}회를 넘었다 (무한 연쇄 의심)`);
    }

    // 특수 블록 결정 → 매치 칸에서 연쇄 발동 → 제거 → 새 특수 블록 배치 (PLAN 4.5)
    const swapped = cascade === 0 ? [a, b] : [];
    let nextId = board.nextId;
    let created = groups.flatMap((group) => {
      const special = decideSpecial(group);
      if (!special) return [];
      const color = special === 'color' ? null : group.color;
      return [{ at: specialPosition(group, swapped), block: { id: nextId++, color, special } }];
    });
    const matched = groups.flatMap((g) => g.cells);
    const chain = burst
      ? colorSwapBurst(board, burst, samePos(burst, a) ? b : a)
      : chainActivate(board, matched);
    const activations = [...chain.activations];
    let cleared = chain.cleared;

    if (newSpecialInBlast === 'explode') {
      const blasted = new Set(chain.activations.flatMap((e) => e.cleared).map(idx));
      const hit = created.filter((n) => blasted.has(idx(n.at)));
      if (hit.length > 0) {
        // 지워진 칸을 비우고 새 블록을 놓은 보드에서, 걸린 새 블록부터 다시 퍼뜨린다
        const placed = board.cells.slice();
        for (const at of cleared) placed[idx(at)] = null;
        for (const n of created) placed[idx(n.at)] = n.block;
        const second = chainActivate(
          { ...board, cells: placed },
          hit.map((n) => n.at),
        );
        activations.push(...second.activations);
        const gone = new Set(second.cleared.map(idx));
        created = created.filter((n) => !gone.has(idx(n.at)));
        const all = new Set([...cleared, ...second.cleared].map(idx));
        cleared = [...all].sort((x, y) => x - y).map((i) => posOf(board, i));
      }
    }

    const inGroup = new Set(matched.map(idx));
    const cells = board.cells.slice();
    const removed: { id: number; at: Pos; bySpecial: boolean }[] = [];
    for (const at of cleared) {
      const i = idx(at);
      const block = cells[i];
      if (!block) continue;
      removed.push({ id: block.id, at, bySpecial: !inGroup.has(i) });
      if (block.color !== null) removedByColor[block.color]!++;
      cells[i] = null;
    }
    for (const n of created) cells[idx(n.at)] = n.block;
    board = { ...board, cells, nextId };
    steps.push([
      { type: 'match', groups, cascade },
      ...activations,
      { type: 'remove', blocks: removed },
      ...created.map((n): GameEvent => ({ type: 'create', block: n.block, at: n.at })),
    ]);

    // 낙하 + 리필은 동시에 재생한다
    const fallen = applyGravity(board);
    const filled = refill(fallen.board, state.colors, rng);
    board = filled.board;
    rng = filled.rng;
    steps.push([fallen.event, filled.event]);

    burst = undefined;
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
