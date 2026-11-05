import { describe, expect, it } from 'vitest';
import type { Board, GameEvent } from '../../src/core/types';
import {
  boardObstacles,
  diffObstacles,
  obstacleActions,
  obstacleDelay,
  refillStart,
  shakeTween,
} from '../../src/view/obstacleState';

const board = (layers: Board['layers']): Board => ({
  rows: 2,
  cols: 2,
  cells: [null, null, null, null],
  nextId: 0,
  layers,
});

describe('boardObstacles', () => {
  it('층이 없으면 비어 있다', () => {
    expect(boardObstacles(board(undefined)).size).toBe(0);
    expect(boardObstacles(board([null, {}, null, null])).size).toBe(0);
  });

  it('잠금·얼음·젤리를 칸별로 옮긴다', () => {
    const map = boardObstacles(board([{ lock: true, jelly: 1 }, null, { frost: 3 }, { jelly: 2 }]));
    expect(map.get('0,0')).toEqual({ lock: true, jelly: 1 });
    expect(map.get('1,0')).toEqual({ frost: 3 });
    expect(map.get('1,1')).toEqual({ jelly: 2 });
    expect(map.has('0,1')).toBe(false);
  });
});

describe('diffObstacles', () => {
  const expected = boardObstacles(board([{ lock: true }, null, { frost: 2 }, null]));

  it('같으면 빈 배열', () => {
    expect(
      diffObstacles(boardObstacles(board([{ lock: true }, null, { frost: 2 }, null])), expected),
    ).toEqual([]);
  });

  it('종류·겹수가 다르면 칸과 함께 알려 준다', () => {
    const actual = boardObstacles(board([null, null, { frost: 1 }, { jelly: 1 }]));
    expect(diffObstacles(actual, expected)).toEqual([
      '0,0 lock: view=undefined board=true',
      '1,0 frost: view=1 board=2',
      '1,1 jelly: view=1 board=undefined',
    ]);
  });
});

describe('obstacleActions', () => {
  it('잠금은 release, 겹이 남으면 hit, 0이면 clear', () => {
    const event: Extract<GameEvent, { type: 'obstacle' }> = {
      type: 'obstacle',
      changes: [
        { at: { r: 0, c: 0 }, kind: 'lock', hp: 0 },
        { at: { r: 0, c: 1 }, kind: 'frost', hp: 2 },
        { at: { r: 1, c: 0 }, kind: 'frost', hp: 0 },
        { at: { r: 1, c: 1 }, kind: 'jelly', hp: 1 },
      ],
    };
    expect(obstacleActions(event).map((a) => a.op)).toEqual(['release', 'hit', 'clear', 'hit']);
  });
});

describe('obstacleDelay', () => {
  const CHAIN = 110;
  const activateAt = (e: { depth: number }) => e.depth * CHAIN;
  const OFFSET = 60;
  const group = (cells: { r: number; c: number }[]) => ({
    color: 0 as const,
    cells,
    maxRunH: 3,
    maxRunV: 0,
    hasIntersection: false,
  });
  const remove = (
    blocks: { id: number; r: number; c: number; bySpecial: boolean }[],
  ): GameEvent => ({
    type: 'remove',
    blocks: blocks.map(({ id, r, c, bySpecial }) => ({ id, at: { r, c }, bySpecial })),
  });
  const activate = (depth: number, cleared: { r: number; c: number }[]): GameEvent => ({
    type: 'activate',
    special: 'lineH',
    at: { r: 0, c: 0 },
    cleared,
    depth,
  });
  const delay = (
    step: GameEvent[],
    kind: 'lock' | 'frost' | 'jelly',
    at: { r: number; c: number },
    removeAt = new Map<number, number>(),
  ) => obstacleDelay(step, { at, kind }, removeAt, activateAt, OFFSET);

  it('젤리는 그 칸 블록이 지워지는 시각', () => {
    const step = [
      remove([
        { id: 1, r: 0, c: 0, bySpecial: false },
        { id: 2, r: 0, c: 1, bySpecial: true },
      ]),
    ];
    const removeAt = new Map([
      [1, 0],
      [2, 220],
    ]);
    expect(delay(step, 'jelly', { r: 0, c: 1 }, removeAt)).toBe(220 + OFFSET);
    expect(delay(step, 'jelly', { r: 0, c: 0 }, removeAt)).toBe(OFFSET);
  });

  it('얼음: 매치로 지워진 이웃의 시각 (특수로 지워진 이웃은 원인이 아니다)', () => {
    const step = [
      remove([
        { id: 1, r: 0, c: 0, bySpecial: false },
        { id: 2, r: 2, c: 1, bySpecial: true },
      ]),
    ];
    const removeAt = new Map([
      [1, 0],
      [2, 220],
    ]);
    expect(delay(step, 'frost', { r: 1, c: 0 }, removeAt)).toBe(OFFSET); // 이웃 (0,0) 매치
    // (2,1)은 특수로 지워져 원인이 아니다: 원인 없음 → offset만
    expect(delay(step, 'frost', { r: 1, c: 1 }, removeAt)).toBe(OFFSET);
  });

  it('얼음: 연쇄 depth 2 발동 범위면 그 발동 시각, 매치 이웃도 있으면 더 이른 쪽', () => {
    const far = { r: 5, c: 5 };
    const step = [remove([{ id: 1, r: 0, c: 0, bySpecial: false }]), activate(2, [far])];
    const removeAt = new Map([[1, 0]]);
    expect(delay(step, 'frost', far, removeAt)).toBe(2 * CHAIN + OFFSET);
    const both = [...step, activate(1, [{ r: 0, c: 1 }])];
    expect(delay(both, 'frost', { r: 0, c: 1 }, removeAt)).toBe(0 + OFFSET); // 이웃 (0,0) 매치가 더 이르다
  });

  it('잠금: 매치에 낀 칸은 0, 발동 범위만이면 가장 이른 발동', () => {
    const at = { r: 3, c: 3 };
    const match: GameEvent = {
      type: 'match',
      groups: [group([{ r: 3, c: 2 }, at, { r: 3, c: 4 }])],
      cascade: 1,
    };
    expect(delay([match], 'lock', at)).toBe(OFFSET);
    const step = [activate(3, [at]), activate(1, [at])];
    expect(delay(step, 'lock', at)).toBe(CHAIN + OFFSET);
  });

  it('제거 없는 발동만 있어도 발동 시각을 따른다', () => {
    const at = { r: 3, c: 3 };
    expect(delay([activate(2, [at])], 'lock', at)).toBe(2 * CHAIN + OFFSET);
  });

  it('원인을 못 찾으면 offset만', () => {
    expect(delay([], 'lock', { r: 0, c: 0 })).toBe(OFFSET);
  });
});

describe('shakeTween', () => {
  it('칸 중심 x가 기준이라 몇 번을 불러도 같은 값 (재입력 때 밀리지 않는다)', () => {
    const a = shakeTween(100, 50);
    expect(shakeTween(100, 50)).toEqual(a);
    expect(a.x).toBeGreaterThan(100);
    expect(a.yoyo).toBe(true);
  });
});

describe('refillStart', () => {
  it('spawnTop 0이면 보드 위에서 떨어진다', () => {
    expect(refillStart({ r: 2, c: 1 }, 3, 0)).toEqual({ row: -1, grow: false });
  });

  it('spawnTop > 0이면 구간 맨 위 칸에서 커진다', () => {
    expect(refillStart({ r: 5, c: 1 }, 2, 3)).toEqual({ row: 3, grow: true });
  });
});
