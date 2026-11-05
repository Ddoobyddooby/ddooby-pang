// 장애물 그림에 쓰는 순수 계산 (PLAN2 5.5). Phaser 없는 함수라 테스트할 수 있다.
// 보드 층 → 그릴 상태, obstacle 이벤트 → 연출 대상, 연출 시작 시각, 리필 시작 위치, view ↔ board 대조.

import { OBSTACLE } from '../config';
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

type ActivateEvent = Extract<GameEvent, { type: 'activate' }>;

const NEIGHBORS = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
] as const;

/**
 * 장애물 칸마다 피해 연출을 시작할 ms (피해를 준 원인이 연출되는 때에 맞춘다, 가장 이른 원인).
 * - 잠금: 그 칸을 낀 매치(0) 또는 그 칸을 cleared에 넣은 발동의 시각
 * - 얼음: 매치로 제거된 4방향 이웃 블록의 제거 시각(특수로 지워진 이웃은 피해를 안 준다) 또는 그 칸을 cleared에 넣은 발동의 시각
 * - 젤리: 그 칸 블록이 지워지는 시각
 * 원인을 못 찾으면(이벤트와 맞지 않을 때) 0. removeAt은 블록 id → 제거 시작 ms (chainTimeline.removeDelays),
 * activateAt은 발동 시각 (chainTimeline.activateDelay), offset은 더할 값
 */
export function obstacleDelay(
  step: readonly GameEvent[],
  action: Pick<ObstacleAction, 'at' | 'kind'>,
  removeAt: ReadonlyMap<number, number>,
  activateAt: (event: ActivateEvent) => number,
  offset: number,
): number {
  const { at, kind } = action;
  const same = (p: Pos, q: Pos) => p.r === q.r && p.c === q.c;
  const times: number[] = [];
  const removed = step.flatMap((event) => (event.type === 'remove' ? event.blocks : []));
  if (kind === 'jelly') {
    for (const b of removed) if (same(b.at, at)) times.push(removeAt.get(b.id) ?? 0);
  } else {
    for (const event of step) {
      if (event.type === 'activate' && event.cleared.some((p) => same(p, at))) {
        times.push(activateAt(event));
      }
      if (kind === 'lock' && event.type === 'match') {
        if (event.groups.some((g) => g.cells.some((p) => same(p, at)))) times.push(0);
      }
    }
    if (kind === 'frost') {
      for (const b of removed) {
        if (b.bySpecial) continue;
        if (NEIGHBORS.some((d) => same({ r: at.r + d.r, c: at.c + d.c }, b.at))) {
          times.push(removeAt.get(b.id) ?? 0);
        }
      }
    }
  }
  return (times.length > 0 ? Math.min(...times) : 0) + offset;
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

/** 잠긴 칸 흔들림 트윈 값: 칸 중심 x(고정 좌표)에서 옆으로 갔다 돌아온다 (재입력 때도 같은 값) */
export function shakeTween(
  x: number,
  cell: number,
): { x: number; duration: number; yoyo: true; repeat: number } {
  const { dx, ms, repeat } = OBSTACLE.lockShake;
  return { x: x + dx * cell, duration: ms, yoyo: true, repeat };
}
