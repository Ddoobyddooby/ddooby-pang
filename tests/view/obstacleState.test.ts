import { describe, expect, it } from 'vitest';
import type { Board, GameEvent } from '../../src/core/types';
import {
  boardObstacles,
  diffObstacles,
  obstacleActions,
  obstacleDelay,
  refillStart,
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
  const step: GameEvent[] = [
    {
      type: 'remove',
      blocks: [
        { id: 1, at: { r: 0, c: 0 }, bySpecial: false },
        { id: 2, at: { r: 0, c: 1 }, bySpecial: false },
      ],
    },
  ];
  const removeAt = new Map([
    [1, 110],
    [2, 0],
  ]);

  it('젤리는 그 칸 블록이 지워지는 시각, 그 외는 가장 이른 시각, offset을 더한다', () => {
    expect(obstacleDelay(step, { at: { r: 0, c: 0 }, kind: 'jelly' }, removeAt, 60)).toBe(170);
    expect(obstacleDelay(step, { at: { r: 5, c: 5 }, kind: 'frost' }, removeAt, 60)).toBe(60);
  });

  it('제거가 없으면 offset만', () => {
    expect(obstacleDelay([], { at: { r: 0, c: 0 }, kind: 'lock' }, new Map(), 60)).toBe(60);
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
