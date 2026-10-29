import { describe, expect, it } from 'vitest';
import { resolveSwap } from '../../src/core/engine';
import { findMatches } from '../../src/core/matcher';
import { createPlayableBoard, findHint, hasAnyMove } from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import type { GameEvent, GameState } from '../../src/core/types';
import { parseBoard, printBoard } from '../helpers/board';

function stateOf(text: string, colors = 6, seed = 1): GameState {
  return { board: parseBoard(text), rngState: createRng(seed), colors };
}

const types = (steps: readonly (readonly GameEvent[])[]) => steps.map((s) => s.map((e) => e.type));

function matchEvents(steps: readonly (readonly GameEvent[])[]) {
  return steps.flat().filter((e): e is Extract<GameEvent, { type: 'match' }> => e.type === 'match');
}

/** 스왑 한 번으로 세로 RRR이 맞고, 그 칸이 내려앉으면서 맨 아랫줄 PPP가 연쇄로 맞는 보드 */
const CASCADE = `
  Y B G
  P G B
  R Y G
  B R Y
  R P P
`;

describe('resolveSwap', () => {
  it('인접하지 않거나 보드 밖이면 아무 일도 없다', () => {
    const state = stateOf(CASCADE);
    for (const [a, b] of [
      [
        { r: 0, c: 0 },
        { r: 1, c: 1 },
      ],
      [
        { r: 0, c: 0 },
        { r: 0, c: 2 },
      ],
      [
        { r: 0, c: 0 },
        { r: -1, c: 0 },
      ],
    ] as const) {
      const result = resolveSwap(state, a, b);
      expect(result.valid).toBe(false);
      expect(result.steps).toEqual([]);
      expect(result.state).toBe(state);
    }
  });

  it('매치 없는 스왑: valid false + swap → swapBack, 상태는 그대로', () => {
    const state = stateOf(CASCADE);
    const a = { r: 0, c: 0 };
    const b = { r: 0, c: 1 };
    const result = resolveSwap(state, a, b);
    expect(result.valid).toBe(false);
    expect(result.steps).toEqual([[{ type: 'swap', a, b }], [{ type: 'swapBack', a, b }]]);
    expect(result.state).toBe(state);
  });

  it('유효한 스왑: 이벤트 순서와 연쇄', () => {
    const state = stateOf(CASCADE);
    const result = resolveSwap(state, { r: 3, c: 0 }, { r: 3, c: 1 });
    expect(result.valid).toBe(true);

    const s = types(result.steps);
    expect(s[0]).toEqual(['swap']);
    expect(s[1]).toEqual(['match', 'remove']);
    expect(s[2]).toEqual(['fall', 'refill']);

    const [first, second] = matchEvents(result.steps);
    // cascade 0: 스왑으로 생긴 세로 RRR
    expect(first!.cascade).toBe(0);
    expect(first!.groups).toHaveLength(1);
    expect(first!.groups[0]).toMatchObject({ color: 0, maxRunV: 3 });
    // cascade 1: P가 (1,0) → (4,0)으로 내려앉아 맨 아랫줄 PPP
    expect(second!.cascade).toBe(1);
    expect(second!.groups.map((g) => g.color)).toContain(4);
    const ppp = second!.groups.find((g) => g.color === 4)!;
    expect(ppp.cells).toEqual(
      expect.arrayContaining([
        { r: 4, c: 0 },
        { r: 4, c: 1 },
        { r: 4, c: 2 },
      ]),
    );
  });

  it('연쇄 번호는 0부터 1씩 증가하고, 단계마다 match+remove → fall+refill', () => {
    const result = resolveSwap(stateOf(CASCADE), { r: 3, c: 0 }, { r: 3, c: 1 });
    const cascades = matchEvents(result.steps).map((e) => e.cascade);
    expect(cascades).toEqual(cascades.map((_, i) => i));
    const body = types(result.steps).slice(1);
    const last = body.at(-1)!;
    const pairs = last[0] === 'shuffle' ? body.slice(0, -1) : body;
    expect(pairs).toHaveLength(cascades.length * 2);
  });

  it('제거 수 집계(removedByColor)와 이벤트가 맞는다', () => {
    const result = resolveSwap(stateOf(CASCADE), { r: 3, c: 0 }, { r: 3, c: 1 });
    const removes = result.steps.flat().filter((e) => e.type === 'remove');
    const total = removes.reduce((n, e) => n + (e.type === 'remove' ? e.blocks.length : 0), 0);
    expect(result.removedByColor.reduce((x, y) => x + y, 0)).toBe(total);
    expect(result.removedByColor[0]).toBeGreaterThanOrEqual(3); // R
    expect(result.removedByColor[4]).toBeGreaterThanOrEqual(3); // P
    expect(result.scoreDelta).toBe(0); // 점수는 W2-08
  });

  it('결과 보드: 빈칸 0, 매치 0, 가능한 수 ≥ 1, 제거된 id는 없다', () => {
    const result = resolveSwap(stateOf(CASCADE), { r: 3, c: 0 }, { r: 3, c: 1 });
    const board = result.state.board;
    expect(board.cells.every((b) => b !== null)).toBe(true);
    expect(findMatches(board)).toEqual([]);
    expect(hasAnyMove(board)).toBe(true);
    const removedIds = new Set(
      result.steps.flat().flatMap((e) => (e.type === 'remove' ? e.blocks.map((b) => b.id) : [])),
    );
    const shuffled = result.steps.flat().some((e) => e.type === 'shuffle');
    if (!shuffled) {
      for (const b of board.cells) expect(removedIds.has(b!.id)).toBe(false);
    }
  });

  it('결정적: 같은 상태 + 같은 스왑 → 같은 결과. 입력 상태는 바뀌지 않는다', () => {
    const state = stateOf(CASCADE, 6, 42);
    const before = printBoard(state.board);
    const a = resolveSwap(state, { r: 3, c: 0 }, { r: 3, c: 1 });
    const b = resolveSwap(state, { r: 3, c: 0 }, { r: 3, c: 1 });
    expect(a).toEqual(b);
    expect(printBoard(state.board)).toBe(before);
    expect(a.state.rngState).not.toBe(state.rngState);
  });

  it('연쇄 상한: 리필이 계속 같은 색이면 무한 연쇄 → 에러', () => {
    // colors=1: 리필 블록이 전부 R이라 연쇄가 끝나지 않는다
    const state = stateOf(
      `
        R Y R
        Y R Y
      `,
      1,
    );
    expect(() => resolveSwap(state, { r: 0, c: 1 }, { r: 1, c: 1 })).toThrow('연쇄');
  });

  it('수가 없어지면 마지막 단계에서 셔플한다 (작은 보드에서 실제로 일어나는지)', () => {
    let shuffles = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const [board, rng] = createPlayableBoard(4, 4, 4, createRng(seed));
      const hint = findHint(board)!;
      const result = resolveSwap({ board, rngState: rng, colors: 4 }, hint.a, hint.b);
      expect(result.valid).toBe(true);
      const last = result.steps.at(-1)!;
      if (last.some((e) => e.type === 'shuffle')) {
        shuffles++;
        expect(last).toHaveLength(1);
        expect(hasAnyMove(result.state.board)).toBe(true);
        expect(findMatches(result.state.board)).toEqual([]);
      }
    }
    expect(shuffles).toBeGreaterThan(0);
  });
});
