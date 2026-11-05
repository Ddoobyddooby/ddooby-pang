// 특수 블록: 결정, 생성 위치, 발동 범위, 연쇄 발동 (PLAN 4.5)

import { SPECIAL } from '../config';
import { getBlock, indexOf, isLocked, posOf, samePos } from './board';
import type { Board, Color, GameEvent, MatchGroup, Pos, SpecialKind } from './types';

/** 그룹이 만드는 특수 블록. 없으면 undefined. 우선순위는 PLAN 4.5 테이블 위에서부터 */
export function decideSpecial(
  group: MatchGroup,
  lineDirection = SPECIAL.lineDirection,
): SpecialKind | undefined {
  const size = group.cells.length;
  if (size >= 6) return 'super';
  if (group.maxRunH >= 5 || group.maxRunV >= 5) return 'color';
  if (size === 5 && group.hasIntersection) return 'bomb';
  const perpendicular = lineDirection === 'perpendicular';
  if (group.maxRunH === 4) return perpendicular ? 'lineV' : 'lineH';
  if (group.maxRunV === 4) return perpendicular ? 'lineH' : 'lineV';
  return undefined;
}

/**
 * 특수 블록을 만들 칸. swapped는 첫 cascade면 스왑한 두 칸 [a, b], 이후 cascade면 [].
 * 스왑 칸이 그룹에 없으면 그룹 중앙(무게중심에 가장 가까운 칸, 같으면 group.cells 순서가 먼저)
 */
export function specialPosition(group: MatchGroup, swapped: readonly Pos[]): Pos {
  const cells = group.cells;
  const hit = swapped.find((s) => cells.some((c) => samePos(c, s)));
  if (hit) return hit;

  // 무게중심과의 거리에 칸 수를 곱해 정수로만 비교한다 (동점 판정에 소수 오차가 끼지 않게)
  const n = cells.length;
  const sumR = cells.reduce((sum, p) => sum + p.r, 0);
  const sumC = cells.reduce((sum, p) => sum + p.c, 0);
  const dist = (p: Pos) => (n * p.r - sumR) ** 2 + (n * p.c - sumC) ** 2;
  return cells.reduce((best, p) => (dist(p) < dist(best) ? p : best));
}

/**
 * 잠긴 칸을 뺀 그룹에서 specialPosition으로 고른 칸. 다 잠겼으면 null (특수 블록을 만들지 않는다, PLAN2 5.2)
 */
export function unlockedSpecialPosition(
  group: MatchGroup,
  swapped: readonly Pos[],
  board: Board,
): Pos | null {
  const free = group.cells.filter((p) => !isLocked(board, p));
  return free.length > 0 ? specialPosition({ ...group, cells: free }, swapped) : null;
}

/**
 * 특수 블록이 at에서 발동할 때 제거되는 칸 (PLAN 4.5). 자기 칸 포함, 보드 밖은 잘림, 행 우선 정렬.
 * color는 targetColor 색 블록 전체이고, targetColor가 null이면 보드 전체
 */
export function blastArea(
  kind: SpecialKind,
  at: Pos,
  board: Board,
  targetColor: Color | null = null,
): Pos[] {
  const inArea = (p: Pos): boolean => {
    const dr = Math.abs(p.r - at.r);
    const dc = Math.abs(p.c - at.c);
    switch (kind) {
      case 'lineH':
        return dr === 0;
      case 'lineV':
        return dc === 0;
      case 'bomb':
        return dr <= 1 && dc <= 1;
      case 'super':
        return (dr <= 2 && dc <= 2) || dr === 0 || dc === 0;
      case 'color':
        return targetColor === null || samePos(p, at) || getBlock(board, p)?.color === targetColor;
    }
  };

  const area: Pos[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    const p = posOf(board, i);
    if (inArea(p)) area.push(p);
  }
  return area;
}

type ActivateEvent = Extract<GameEvent, { type: 'activate' }>;

/** 보드에서 가장 많은 색. 동점이면 번호가 작은 색. 일반 블록이 없으면 null */
function mostCommonColor(board: Board): Color | null {
  const counts = new Array<number>(6).fill(0);
  for (const block of board.cells) if (block && block.color !== null) counts[block.color]!++;
  const max = Math.max(...counts);
  return max > 0 ? (counts.indexOf(max) as Color) : null;
}

/**
 * start 칸들을 제거할 때 함께 발동하는 특수 블록을 BFS로 퍼뜨린다 (PLAN 4.5 연쇄 발동).
 * 블록마다 최대 한 번 발동. cleared는 start와 모든 발동 범위의 합집합 (행 우선 정렬).
 * activated: 이미 발동한 칸 (컬러 스왑 발동). 제거는 되지만 다시 발동하지 않는다.
 * depth: start 칸에서 발동하는 블록의 차례. 휘말린 블록은 터뜨린 블록의 차례 + 1 (PLAN 6.13).
 * 배열이면 start 칸마다 차례 (컬러 + 특수 블록 조합, PLAN 6.18). 차례가 이른 블록부터 발동하고
 * 같으면 먼저 들어온 블록부터라, 시작 칸 차례가 모두 같으면 보통 BFS와 같다.
 * 잠긴 특수 블록은 범위에 들어도 발동하지 않는다 (잠금만 풀린다, PLAN2 5.2)
 */
export function chainActivate(
  board: Board,
  start: readonly Pos[],
  activated: readonly Pos[] = [],
  depth: number | readonly number[] = 0,
): { cleared: Pos[]; activations: ActivateEvent[] } {
  const fired = new Set(activated.map((p) => indexOf(board, p)));
  const seen = new Set<number>();
  const queue: { at: Pos; depth: number }[] = [];
  const add = (p: Pos, d: number) => {
    const i = indexOf(board, p);
    if (seen.has(i)) return;
    seen.add(i);
    if (getBlock(board, p)?.special && !fired.has(i) && !isLocked(board, p)) {
      queue.push({ at: p, depth: d });
    }
  };
  start.forEach((p, k) => add(p, typeof depth === 'number' ? depth : depth[k]!));

  const activations: ActivateEvent[] = [];
  while (queue.length > 0) {
    let k = 0;
    for (let j = 1; j < queue.length; j++) if (queue[j]!.depth < queue[k]!.depth) k = j;
    const { at, depth: d } = queue.splice(k, 1)[0]!;
    const special = getBlock(board, at)!.special!;
    // 연쇄로 휘말린 컬러 블록은 스왑 상대가 없어 가장 많은 색을 지운다
    const target = special === 'color' ? mostCommonColor(board) : null;
    const cleared = blastArea(special, at, board, target);
    activations.push({ type: 'activate', special, at, cleared, depth: d });
    cleared.forEach((p) => add(p, d + 1));
  }

  return {
    cleared: [...seen].sort((a, b) => a - b).map((i) => posOf(board, i)),
    activations,
  };
}
