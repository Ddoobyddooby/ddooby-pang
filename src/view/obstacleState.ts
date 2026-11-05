// 장애물 그림에 쓰는 순수 계산 (PLAN2 5.5). Phaser 없는 함수라 테스트할 수 있다.
// 보드 층 → 그릴 상태, obstacle 이벤트 → 연출 대상, 연출 시작 시각, 리필 시작 위치, view ↔ board 대조.

import type { Board, GameEvent, ObstacleKind, Pos } from '../core/types';

/** 한 칸에 보이는 장애물. frost·jelly는 남은 겹수 */
export interface ObstacleCell {
  lock?: true;
  frost?: number;
  jelly?: number;
}

/** "r,c" → 장애물이 있는 칸의 상태 */
export type ObstacleMap = Map<string, ObstacleCell>;

export const posKey = ({ r, c }: Pos): string => `${r},${c}`;

/** 보드 층에서 그릴 장애물 상태를 만든다. 장애물이 없는 칸은 넣지 않는다 */
export function boardObstacles(board: Board): ObstacleMap {
  const out: ObstacleMap = new Map();
  board.layers?.forEach((layer, i) => {
    if (!layer) return;
    const cell: ObstacleCell = {};
    if (layer.lock) cell.lock = true;
    if (layer.frost) cell.frost = layer.frost;
    if (layer.jelly) cell.jelly = layer.jelly;
    if (Object.keys(cell).length === 0) return;
    out.set(posKey({ r: Math.floor(i / board.cols), c: i % board.cols }), cell);
  });
  return out;
}

/** 지금 화면에 보이는 장애물과 보드 층이 다른 칸을 설명하는 문장들 (DEV 대조, 비면 같다) */
export function diffObstacles(actual: ObstacleMap, expected: ObstacleMap): string[] {
  const keys = new Set([...actual.keys(), ...expected.keys()]);
  const wrong: string[] = [];
  for (const key of [...keys].sort()) {
    const a = actual.get(key) ?? {};
    const e = expected.get(key) ?? {};
    for (const kind of ['lock', 'frost', 'jelly'] as const) {
      if (a[kind] !== e[kind]) wrong.push(`${key} ${kind}: view=${a[kind]} board=${e[kind]}`);
    }
  }
  return wrong;
}

/** 연출 종류: 잠금 해제 / 얼음·젤리가 한 겹 줄어듦 / 얼음·젤리가 다 없어짐 */
export type ObstacleOp = 'release' | 'hit' | 'clear';

export interface ObstacleAction {
  at: Pos;
  kind: ObstacleKind;
  /** 피해 뒤 남은 겹 (잠금·clear는 0) */
  hp: number;
  op: ObstacleOp;
}

type ObstacleEvent = Extract<GameEvent, { type: 'obstacle' }>;

/** obstacle 이벤트의 변화를 연출 대상으로 바꾼다 (이벤트 순서 그대로) */
export function obstacleActions(event: ObstacleEvent): ObstacleAction[] {
  return event.changes.map(({ at, kind, hp }) => ({
    at,
    kind,
    hp,
    op: kind === 'lock' ? 'release' : hp > 0 ? 'hit' : 'clear',
  }));
}

/**
 * 연출을 시작할 ms (같은 step의 블록 제거가 터지는 때에 맞춘다).
 * 젤리는 그 칸의 블록이 지워지는 시각, 잠금·얼음은 step에서 가장 먼저 지워지는 블록의 시각.
 * removeAt은 블록 id → 제거 시작 ms (chainTimeline.removeDelays), offset은 더할 값
 */
export function obstacleDelay(
  step: readonly GameEvent[],
  action: Pick<ObstacleAction, 'at' | 'kind'>,
  removeAt: ReadonlyMap<number, number>,
  offset: number,
): number {
  const removed = step.flatMap((event) => (event.type === 'remove' ? event.blocks : []));
  const delays = removed.map((b) => ({ at: b.at, ms: removeAt.get(b.id) ?? 0 }));
  if (delays.length === 0) return offset;
  const own =
    action.kind === 'jelly'
      ? delays.find(({ at }) => at.r === action.at.r && at.c === action.at.c)
      : undefined;
  return (own?.ms ?? Math.min(...delays.map((d) => d.ms))) + offset;
}

/**
 * 리필 블록이 나타나는 시작 행. spawnTop이 0이면 보드 위에서 떨어지고(at.r - dropFrom),
 * 아니면 고정 칸 바로 아래 구간 맨 위 칸에서 작게 나타나 커진다 (grow)
 */
export function refillStart(
  at: Pos,
  dropFrom: number,
  spawnTop: number,
): { row: number; grow: boolean } {
  return spawnTop > 0 ? { row: spawnTop, grow: true } : { row: at.r - dropFrom, grow: false };
}
