import { describe, expect, it } from 'vitest';
import type { GameEvent, Pos, SpecialKind } from '../../src/core/types';
import { activateDelay, flashDelay, removeDelays } from '../../src/view/fx/chainTimeline';

const p = (r: number, c: number): Pos => ({ r, c });
const row = (r: number, cols = 4) => Array.from({ length: cols }, (_, c) => p(r, c));
const col = (c: number, rows = 4) => Array.from({ length: rows }, (_, r) => p(r, c));

function activate(special: SpecialKind, at: Pos, cleared: Pos[], depth: number) {
  return { type: 'activate', special, at, cleared, depth } as const;
}
function match(cells: Pos[]): GameEvent {
  return {
    type: 'match',
    cascade: 0,
    groups: [{ color: 0, cells, maxRunH: cells.length, maxRunV: 0, hasIntersection: false }],
  };
}
/** 칸마다 id = r * 10 + c 인 remove 이벤트 */
function remove(cells: Pos[]): GameEvent {
  return {
    type: 'remove',
    blocks: cells.map((at) => ({ id: at.r * 10 + at.c, at, bySpecial: false })),
  };
}
/** id → ms 를 "r,c:ms" 로 (보기 쉽게) */
function summary(step: GameEvent[], chainStep = 100) {
  return Object.fromEntries(
    [...removeDelays(step, chainStep)].map(([id, ms]) => [`${Math.floor(id / 10)},${id % 10}`, ms]),
  );
}

describe('activateDelay / flashDelay', () => {
  it.each([
    [0, 0, null],
    [1, 100, 0],
    [3, 300, 200],
  ])('차례 %i → 발동 %i ms, 번쩍 %s', (depth, fire, flash) => {
    const e = activate('lineH', p(0, 0), [], depth);
    expect(activateDelay(e, 100)).toBe(fire);
    expect(flashDelay(e, 100)).toBe(flash);
  });
});

describe('removeDelays', () => {
  it('발동 없는 일반 매치: 모두 0', () => {
    const cells = [p(0, 0), p(0, 1), p(0, 2)];
    expect(summary([match(cells), remove(cells)])).toEqual({ '0,0': 0, '0,1': 0, '0,2': 0 });
  });

  it('단일 발동: 매치 칸과 범위 모두 0 (예전과 같다)', () => {
    const cells = [p(0, 0), p(0, 1), p(0, 2)];
    const step = [match(cells), activate('lineH', p(0, 0), row(0), 0), remove(row(0))];
    expect(summary(step)).toEqual({ '0,0': 0, '0,1': 0, '0,2': 0, '0,3': 0 });
  });

  it('줄 → 줄: 휘말린 줄 블록과 그 열은 다음 차례, 앞 차례가 지운 칸은 그대로', () => {
    const cells = [p(0, 0), p(0, 1), p(0, 2)];
    const step = [
      match(cells),
      activate('lineH', p(0, 0), row(0), 0),
      activate('lineV', p(0, 3), col(3), 1),
      remove([...row(0), p(1, 3), p(2, 3), p(3, 3)]),
    ];
    expect(summary(step)).toEqual({
      '0,0': 0,
      '0,1': 0,
      '0,2': 0,
      '0,3': 100, // 휘말린 lineV 자신은 자기 차례에
      '1,3': 100,
      '2,3': 100,
      '3,3': 100,
    });
  });

  it('겹치는 범위는 가장 이른 차례, 휘말린 블록끼리는 각자 차례', () => {
    // lineH(0) → lineV@0,3 (1) → lineH@3,3 (2). 3행은 차례 2에, 3열의 (3,3)은 차례 2(자기 자신)
    const step = [
      match([p(0, 0), p(0, 1), p(0, 2)]),
      activate('lineH', p(0, 0), row(0), 0),
      activate('lineV', p(0, 3), col(3), 1),
      activate('lineH', p(3, 3), row(3), 2),
      remove([...row(0), p(1, 3), p(2, 3), ...row(3)]),
    ];
    expect(summary(step, 90)).toEqual({
      '0,0': 0,
      '0,1': 0,
      '0,2': 0,
      '0,3': 90,
      '1,3': 90,
      '2,3': 90,
      '3,0': 180,
      '3,1': 180,
      '3,2': 180,
      '3,3': 180,
    });
  });

  it('매치 그룹 칸은 뒤 차례 범위에 들어 있어도 0', () => {
    const cells = [p(1, 0), p(1, 1), p(1, 2)];
    const step = [
      match(cells),
      activate('lineV', p(1, 0), col(0, 2), 0),
      activate('lineH', p(0, 0), [p(0, 0), p(0, 1)], 1),
      activate('lineV', p(0, 1), col(1, 2), 2),
      remove([p(0, 0), p(0, 1), ...cells]),
    ];
    expect(summary(step)).toEqual({ '0,0': 100, '0,1': 200, '1,0': 0, '1,1': 0, '1,2': 0 });
  });

  it('컬러 스왑 발동(매치 없음): 첫 발동 범위 0, 휘말린 블록은 차례 1', () => {
    const step = [
      activate('color', p(0, 1), [p(0, 0), p(0, 1), p(2, 0)], 0),
      activate('lineH', p(0, 0), row(0, 3), 1),
      remove([p(0, 0), p(0, 1), p(0, 2), p(2, 0)]),
    ];
    expect(summary(step)).toEqual({ '0,0': 100, '0,1': 0, '0,2': 100, '2,0': 0 });
  });
});
