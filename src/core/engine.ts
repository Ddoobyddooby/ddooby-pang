// 처리 루프 (PLAN 4.3): 스왑 → 매치 → 제거 → 점수 → 낙하 → 리필 → (연쇄 반복) → 수 없으면 셔플

import { BOARD, SPECIAL, TIMEATTACK } from '../config';
import { getBlock, indexOf, inBounds, isAdjacent, posOf, samePos, swapBlocks } from './board';
import { applyGravity, refill } from './gravity';
import { findMatches } from './matcher';
import { createPlayableBoard, hasAnyMove, shuffle } from './moves';
import { createRng } from './rng';
import { stepScore } from './scoring';
import { blastArea, chainActivate, decideSpecial, specialPosition } from './specials';
import type { Board, GameEvent, GameState, MatchGroup, Pos, ResolveResult } from './types';

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
  const chain = chainActivate(board, cleared, other.special === 'color' ? [at, partner] : [at], 1);
  const first: GameEvent = { type: 'activate', special: 'color', at, cleared, depth: 0 };
  return { cleared: chain.cleared, activations: [first, ...chain.activations] };
}

export function resolveSwap(
  state: GameState,
  a: Pos,
  b: Pos,
  newSpecialInBlast = SPECIAL.newSpecialInBlast,
): ResolveResult {
  const start = state.board;
  if (!inBounds(start, a) || !inBounds(start, b) || !isAdjacent(a, b)) return invalid(state, []);
  if (!getBlock(start, a) || !getBlock(start, b)) return invalid(state, []);

  const board = swapBlocks(start, a, b);
  // 컬러 블록 스왑은 매치 없이 바로 발동한다. 둘 다 컬러면 끌어온 쪽(a의 블록, 지금 b 칸)
  const burst = [b, a].find((p) => getBlock(board, p)?.special === 'color');
  const groups = burst ? [] : findMatches(board);
  if (!burst && groups.length === 0) {
    return invalid(state, [[{ type: 'swap', a, b }], [{ type: 'swapBack', a, b }]]);
  }

  const removedByColor = new Array<number>(COLOR_COUNT).fill(0);
  const trigger: Trigger = burst
    ? { kind: 'burst', at: burst, partner: samePos(burst, a) ? b : a }
    : { kind: 'match', groups, swapped: [a, b] };
  const run = runCascades(board, state, trigger, newSpecialInBlast, removedByColor);
  return finishResolve(state, run.board, run.rng, [[{ type: 'swap', a, b }], ...run.steps], {
    scoreDelta: run.scoreDelta,
    removedByColor,
  });
}

/**
 * 경쟁 모드 마지막 팡 (SPEC 3.3, PLAN 6.14): 판에 남은 특수 블록을 한 라운드에 하나씩
 * 행 우선 첫 블록부터 발동한다. 생긴 매치는 보통 연쇄처럼 끝까지 (라운드마다 cascade 0부터).
 * 특수 블록이 없으면 valid: false, steps: [], 상태 그대로. 라운드는 maxRounds를 넘지 않는다
 */
export function resolveFinale(
  state: GameState,
  maxRounds: number = TIMEATTACK.finale.maxRounds,
  newSpecialInBlast = SPECIAL.newSpecialInBlast,
): ResolveResult {
  const firstSpecial = (board: Board) => board.cells.findIndex((block) => block?.special);
  if (firstSpecial(state.board) < 0) return invalid(state, []);

  let board = state.board;
  let rng = state.rngState;
  const steps: GameEvent[][] = [];
  const removedByColor = new Array<number>(COLOR_COUNT).fill(0);
  let scoreDelta = 0;
  for (let round = 0; round < maxRounds; round++) {
    const i = firstSpecial(board);
    if (i < 0) break;
    const trigger: Trigger = { kind: 'fire', at: posOf(board, i) };
    const run = runCascades(
      board,
      { ...state, rngState: rng },
      trigger,
      newSpecialInBlast,
      removedByColor,
    );
    board = run.board;
    rng = run.rng;
    steps.push(...run.steps);
    scoreDelta += run.scoreDelta;
  }
  return finishResolve(state, board, rng, steps, { scoreDelta, removedByColor });
}

/** 첫 단계를 일으킨 것: 스왑 매치 / 컬러 스왑 발동 / 마지막 팡의 특수 블록 하나 */
type Trigger =
  | { kind: 'match'; groups: MatchGroup[]; swapped: Pos[] }
  | { kind: 'burst'; at: Pos; partner: Pos }
  | { kind: 'fire'; at: Pos };

/**
 * 연쇄 루프 (PLAN 4.3): 매치·발동 → 제거 → 점수 → 낙하·리필을 매치가 없을 때까지.
 * 보드·rng는 state 대신 인자로 받은 값부터, removedByColor는 그 배열에 더한다
 */
function runCascades(
  start: Board,
  state: GameState,
  trigger: Trigger,
  newSpecialInBlast: 'keep' | 'explode',
  removedByColor: number[],
): { board: Board; rng: number; steps: GameEvent[][]; scoreDelta: number } {
  const idx = (p: Pos) => indexOf(start, p);
  let board = start;
  let rng = state.rngState;
  const steps: GameEvent[][] = [];
  let scoreDelta = 0;
  let first: Trigger | undefined = trigger;
  let groups = trigger.kind === 'match' ? trigger.groups : [];

  for (let cascade = 0; first || groups.length > 0; cascade++) {
    if (cascade >= BOARD.maxCascade) {
      throw new Error(`연쇄가 ${BOARD.maxCascade}회를 넘었다 (무한 연쇄 의심)`);
    }

    // 특수 블록 결정 → 매치 칸에서 연쇄 발동 → 제거 → 새 특수 블록 배치 (PLAN 4.5)
    const swapped = first?.kind === 'match' ? first.swapped : [];
    let nextId = board.nextId;
    let created = groups.flatMap((group) => {
      const special = decideSpecial(group);
      if (!special) return [];
      const color = special === 'color' ? null : group.color;
      return [{ at: specialPosition(group, swapped), block: { id: nextId++, color, special } }];
    });
    const matched = groups.flatMap((g) => g.cells);
    const chain =
      first?.kind === 'burst'
        ? colorSwapBurst(board, first.at, first.partner)
        : chainActivate(board, first?.kind === 'fire' ? [first.at] : matched);
    const activations = [...chain.activations];
    let cleared = chain.cleared;

    if (newSpecialInBlast === 'explode') {
      const blasted = new Set(chain.activations.flatMap((e) => e.cleared).map(idx));
      const hit = created.filter((n) => blasted.has(idx(n.at)));
      if (hit.length > 0) {
        // 걸린 새 블록은 그 칸을 덮은 발동 중 가장 이른 차례 다음에 터진다
        const hitIdx = new Set(hit.map((n) => idx(n.at)));
        const depth =
          1 +
          Math.min(
            ...chain.activations
              .filter((e) => e.cleared.some((p) => hitIdx.has(idx(p))))
              .map((e) => e.depth),
          );
        // 지워진 칸을 비우고 새 블록을 놓은 보드에서, 걸린 새 블록부터 다시 퍼뜨린다
        const placed = board.cells.slice();
        for (const at of cleared) placed[idx(at)] = null;
        for (const n of created) placed[idx(n.at)] = n.block;
        const second = chainActivate(
          { ...board, cells: placed },
          hit.map((n) => n.at),
          [],
          depth,
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

    // 점수 (PLAN 4.8): 그룹 칸은 groupBase로만, 나머지는 특수 효과 제거로 센다
    const bySpecialCount = removed.filter((r) => r.bySpecial).length;
    const delta = stepScore(groups, bySpecialCount, cascade);
    scoreDelta += delta;
    // 팝업 위치: 첫 그룹의 중앙, 그룹이 없으면(컬러 스왑 발동·마지막 팡) 발동 칸
    const scoreAt = groups[0]
      ? specialPosition(groups[0], [])
      : (first as Extract<Trigger, { at: Pos }>).at;

    steps.push([
      { type: 'match', groups, cascade },
      ...activations,
      { type: 'remove', blocks: removed },
      ...created.map((n): GameEvent => ({ type: 'create', block: n.block, at: n.at })),
      { type: 'score', delta, cascade, at: scoreAt },
    ]);

    // 낙하 + 리필은 동시에 재생한다
    const fallen = applyGravity(board);
    const filled = refill(fallen.board, state.colors, rng);
    board = filled.board;
    rng = filled.rng;
    steps.push([fallen.event, filled.event]);

    first = undefined;
    groups = findMatches(board);
  }

  return { board, rng, steps, scoreDelta };
}

/** 가능한 수가 없으면 셔플하고 불변식을 확인해 결과를 만든다 */
function finishResolve(
  state: GameState,
  resolved: Board,
  rngState: number,
  steps: GameEvent[][],
  totals: { scoreDelta: number; removedByColor: number[] },
): ResolveResult {
  let board = resolved;
  let rng = rngState;
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
    ...totals,
    valid: true,
  };
}
