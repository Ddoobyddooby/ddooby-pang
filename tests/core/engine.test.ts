import { describe, expect, it } from 'vitest';
import { createInitialState, resolveFinale, resolveSwap } from '../../src/core/engine';
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
    expect(s[1]).toEqual(['match', 'remove', 'score']);
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

// W2-05: 특수 블록 생성·발동 (PLAN 4.3, 4.5)
describe('resolveSwap: 특수 블록', () => {
  const p = (r: number, c: number) => ({ r, c });

  /** 첫 match step (cascade 0)의 이벤트 */
  function firstStep(result: ReturnType<typeof resolveSwap>) {
    const step = result.steps[1]!;
    const of = <T extends GameEvent['type']>(type: T) =>
      step.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
    return {
      types: step.map((e) => e.type),
      activate: of('activate').map((e) => `${e.special}@${e.at.r},${e.at.c}`),
      depths: of('activate').map((e) => e.depth),
      create: of('create').map((e) => ({
        at: e.at,
        special: e.block.special,
        color: e.block.color,
      })),
      removed: of('remove')[0]!.blocks,
    };
  }

  // (0,2) Y ↔ (1,2) R → 0행 R R R R
  const FOUR = `
    R R Y R B
    G B R G Y
    Y G B Y G
  `;
  const FOUR_WITH_LINE = `
    R R Y R- B
    G B R G  Y
    Y G B Y  G
  `;

  it('4I 가로 → 스왑 칸에 세로줄(lineV) 생성, 이벤트 순서 match → remove → create', () => {
    const result = resolveSwap(stateOf(FOUR, 5), p(0, 2), p(1, 2));
    const step = firstStep(result);
    expect(step.types).toEqual(['match', 'remove', 'create', 'score']);
    expect(step.create).toEqual([{ at: p(0, 2), special: 'lineV', color: 0 }]);
    expect(step.removed.map((b) => b.at)).toEqual([p(0, 0), p(0, 1), p(0, 2), p(0, 3)]);
    expect(step.removed.every((b) => !b.bySpecial)).toBe(true);
  });

  it('새 블록 id는 board.nextId부터', () => {
    const state = stateOf(FOUR, 5);
    const create = resolveSwap(state, p(0, 2), p(1, 2))
      .steps.flat()
      .find((e) => e.type === 'create')!;
    expect(create.type === 'create' && create.block.id).toBe(state.board.nextId);
  });

  it('매치에 섞인 줄 블록이 발동: 범위의 블록은 bySpecial로 제거', () => {
    const result = resolveSwap(stateOf(FOUR_WITH_LINE, 5), p(0, 2), p(1, 2));
    const step = firstStep(result);
    expect(step.types).toEqual(['match', 'activate', 'remove', 'create', 'score']);
    expect(step.activate).toEqual(['lineH@0,3']);
    const extra = step.removed.filter((b) => b.bySpecial).map((b) => b.at);
    expect(extra).toEqual([p(0, 4)]);
    expect(result.removedByColor[3]).toBeGreaterThanOrEqual(1); // (0,4)의 B
  });

  it("'keep'(기본): 생성 칸이 발동 범위에 걸려도 새 특수 블록은 남는다", () => {
    const step = firstStep(resolveSwap(stateOf(FOUR_WITH_LINE, 5), p(0, 2), p(1, 2), 'keep'));
    expect(step.create).toEqual([{ at: p(0, 2), special: 'lineV', color: 0 }]);
  });

  it("'explode': 새 특수 블록이 바로 발동하고 create는 없다", () => {
    const step = firstStep(resolveSwap(stateOf(FOUR_WITH_LINE, 5), p(0, 2), p(1, 2), 'explode'));
    expect(step.types).toEqual(['match', 'activate', 'activate', 'remove', 'score']);
    expect(step.activate).toEqual(['lineH@0,3', 'lineV@0,2']);
    expect(step.depths).toEqual([0, 1]);
    expect(step.create).toEqual([]);
    // 새 세로줄이 2열을 지운다
    const extra = step.removed.filter((b) => b.bySpecial).map((b) => b.at);
    expect(extra).toEqual([p(0, 4), p(1, 2), p(2, 2)]);
  });

  it('특수 블록도 낙하한다 (id와 special 유지)', () => {
    // (1,2) G ↔ (2,2) R → 1행 R R R. 위의 B-가 내려온다
    const state = stateOf(
      `
        B- G Y
        R  R G
        Y  B R
      `,
      5,
    );
    const lineId = state.board.cells[0]!.id;
    const result = resolveSwap(state, p(1, 2), p(2, 2));
    const fall = result.steps[2]!.find((e) => e.type === 'fall')!;
    expect(fall.type === 'fall' && fall.moves).toContainEqual({
      id: lineId,
      from: p(0, 0),
      to: p(1, 0),
    });
  });

  it('연쇄 중 생긴 4매치는 그룹 중앙에 생성', () => {
    // (3,2) B ↔ (4,2) Y → 2열 Y Y Y. 0행 R이 (3,2)로 떨어져 3행 R R R R
    const result = resolveSwap(
      stateOf(
        `
          G B R Y
          B G Y B
          G B Y G
          R R B R
          Y G Y B
        `,
        5,
      ),
      p(3, 2),
      p(4, 2),
    );
    const second = result.steps[3]!;
    expect(second[0]).toMatchObject({ type: 'match', cascade: 1 });
    expect(second.find((e) => e.type === 'create')).toMatchObject({
      at: p(3, 1),
      block: { special: 'lineV', color: 0 },
    });
  });
});

// W2-06: 컬러 블록 스왑 발동 (PLAN 4.3)
describe('resolveSwap: 컬러 블록 스왑', () => {
  const p = (r: number, c: number) => ({ r, c });

  function firstStep(result: ReturnType<typeof resolveSwap>) {
    const step = result.steps[1]!;
    return {
      types: step.map((e) => e.type),
      activate: step.flatMap((e) =>
        e.type === 'activate' ? [`${e.special}@${e.at.r},${e.at.c}`] : [],
      ),
      depths: step.flatMap((e) => (e.type === 'activate' ? [e.depth] : [])),
      removed: step.flatMap((e) => (e.type === 'remove' ? e.blocks.map((b) => b.at) : [])),
      bySpecial: step.every((e) => e.type !== 'remove' || e.blocks.every((b) => b.bySpecial)),
    };
  }

  it('컬러 ↔ 일반: 매치가 없어도 valid, 스왑 후 자리에서 상대 색 전체 제거', () => {
    const result = resolveSwap(
      stateOf(
        `
          C Y R
          G R B
          Y B G
        `,
        5,
      ),
      p(0, 0),
      p(0, 1),
    );
    expect(result.valid).toBe(true);
    expect(result.steps[0]).toEqual([{ type: 'swap', a: p(0, 0), b: p(0, 1) }]);
    const step = firstStep(result);
    expect(step.types).toEqual(['match', 'activate', 'remove', 'score']);
    expect(result.steps[1]![0]).toEqual({ type: 'match', groups: [], cascade: 0 });
    expect(step.activate).toEqual(['color@0,1']); // 컬러 블록은 (0,1)로 옮겨졌다
    // Y: 스왑 후 (0,0), (2,0) + 컬러 블록 자신 (0,1)
    expect(step.removed).toEqual([p(0, 0), p(0, 1), p(2, 0)]);
    expect(step.bySpecial).toBe(true);
    expect(result.removedByColor[1]).toBeGreaterThanOrEqual(2);
  });

  it('일반 ↔ 컬러 (b 쪽이 컬러)도 같다', () => {
    const step = firstStep(
      resolveSwap(
        stateOf(
          `
            Y C R
            G R B
            Y B G
          `,
          5,
        ),
        p(0, 0),
        p(0, 1),
      ),
    );
    expect(step.activate).toEqual(['color@0,0']);
    expect(step.removed).toEqual([p(0, 0), p(0, 1), p(2, 0)]);
  });

  it('컬러 ↔ 특수 블록: 그 블록의 색을 지우고, 상대 특수 블록은 연쇄 발동', () => {
    const step = firstStep(
      resolveSwap(
        stateOf(
          `
            C Y- R
            G R  B
            Y B  G
          `,
          5,
        ),
        p(0, 0),
        p(0, 1),
      ),
    );
    // Y- 는 (0,0)으로 옮겨졌다 → 0행 줄 제거
    expect(step.activate).toEqual(['color@0,1', 'lineH@0,0']);
    expect(step.depths).toEqual([0, 1]);
    expect(step.removed).toEqual([p(0, 0), p(0, 1), p(0, 2), p(2, 0)]);
  });

  it('컬러 ↔ 컬러: 보드 전체, 발동은 하나', () => {
    const result = resolveSwap(
      stateOf(
        `
          C C R
          G R B
          Y B G
        `,
        5,
      ),
      p(0, 0),
      p(0, 1),
    );
    const step = firstStep(result);
    expect(step.activate).toEqual(['color@0,1']);
    expect(step.removed).toHaveLength(9);
    expect(result.valid).toBe(true);
  });
});

// W2-08: 점수 (PLAN 4.8)
describe('resolveSwap: 점수', () => {
  const p = (r: number, c: number) => ({ r, c });
  const scoreEvents = (steps: readonly (readonly GameEvent[])[]) =>
    steps.flat().filter((e): e is Extract<GameEvent, { type: 'score' }> => e.type === 'score');

  // (0,2) Y ↔ (1,2) R → 0행 R R R. seed 1에서는 리필 후 연쇄가 없다
  const THREE = `
    R R Y B
    G B R G
    Y G B Y
    B Y G R
  `;

  it('단순 3매치(연쇄 없음) → 30점, 그 step 맨 끝에 score 1개, at은 그룹 중앙', () => {
    const result = resolveSwap(stateOf(THREE, 6, 1), p(0, 2), p(1, 2));
    expect(matchEvents(result.steps)).toHaveLength(1);
    expect(result.scoreDelta).toBe(30);
    const step = result.steps[1]!;
    expect(step.filter((e) => e.type === 'score')).toHaveLength(1);
    expect(step.at(-1)).toEqual({ type: 'score', delta: 30, cascade: 0, at: p(0, 1) });
  });

  it('무효 스왑 → 0점, score 이벤트 없음', () => {
    const result = resolveSwap(stateOf(CASCADE), p(0, 0), p(0, 1));
    expect(result.scoreDelta).toBe(0);
    expect(scoreEvents(result.steps)).toEqual([]);
  });

  it('연쇄: cascade마다 score 1개, 배율이 붙고 scoreDelta는 그 합', () => {
    const result = resolveSwap(stateOf(CASCADE), p(3, 0), p(3, 1));
    const scores = scoreEvents(result.steps);
    expect(scores.map((e) => e.cascade)).toEqual(matchEvents(result.steps).map((e) => e.cascade));
    expect(scores[0]!.delta).toBe(30); // RRR
    expect(scores[1]!.delta).toBeGreaterThanOrEqual(45); // PPP × 1.5
    expect(result.scoreDelta).toBe(scores.reduce((sum, e) => sum + e.delta, 0));
  });

  it('컬러 스왑 발동 → cascade 0에서 지운 블록 수 × 20, at은 발동 칸', () => {
    const result = resolveSwap(
      stateOf(
        `
          C Y R
          G R B
          Y B G
        `,
        5,
      ),
      p(0, 0),
      p(0, 1),
    );
    const step = result.steps[1]!;
    const removed = step.flatMap((e) => (e.type === 'remove' ? e.blocks : []));
    expect(step.at(-1)).toEqual({
      type: 'score',
      delta: removed.length * 20,
      cascade: 0,
      at: p(0, 1),
    });
  });
});

// W4-21: 경쟁 모드 마지막 팡 (SPEC 3.3, PLAN 6.14)
describe('resolveFinale', () => {
  const p = (r: number, c: number) => ({ r, c });
  /** 라운드 = 매치 그룹 없이 cascade 0으로 시작하는 단계 (특수 블록 하나 발동) */
  const rounds = (steps: readonly (readonly GameEvent[])[]) =>
    matchEvents(steps).filter((e) => e.cascade === 0 && e.groups.length === 0);
  const specialsLeft = (state: GameState) => state.board.cells.filter((b) => b?.special).length;

  /** seed 보드에 특수 블록을 흩뿌린 상태 (?specials처럼 색은 그대로) */
  function withSpecials(seed: number): GameState {
    const state = createInitialState({ rows: 8, cols: 8, colors: 5, seed });
    const cells = state.board.cells.slice();
    const kinds = ['lineH', 'lineV', 'bomb', 'super', 'color'] as const;
    kinds.forEach((special, k) => {
      const i = (seed * 11 + k * 17) % 64;
      const block = cells[i]!;
      cells[i] = { id: block.id, color: special === 'color' ? null : block.color, special };
    });
    return { ...state, board: { ...state.board, cells } };
  }

  it('특수 블록이 없으면 valid: false, steps 없음, 상태 그대로', () => {
    const state = createInitialState({ rows: 8, cols: 8, colors: 5, seed: 3 });
    const result = resolveFinale(state);
    expect(result.valid).toBe(false);
    expect(result.steps).toEqual([]);
    expect(result.state).toBe(state);
    expect(result.scoreDelta).toBe(0);
  });

  it('줄 블록 하나: 라운드 1번, 그 줄이 지워지고 첫 단계는 match(빈 그룹) + activate + remove + score', () => {
    const state = stateOf(
      `
        R Y  G B
        G B- R Y
        Y G  B R
        B R  Y G
      `,
      4,
    );
    const result = resolveFinale(state);
    expect(result.valid).toBe(true);
    expect(rounds(result.steps)).toHaveLength(1);
    const first = result.steps[0]!;
    expect(first.map((e) => e.type)).toEqual(['match', 'activate', 'remove', 'score']);
    const remove = first.find((e) => e.type === 'remove') as Extract<GameEvent, { type: 'remove' }>;
    expect(remove.blocks.map((b) => b.at)).toEqual([p(1, 0), p(1, 1), p(1, 2), p(1, 3)]);
    const score = first.find((e) => e.type === 'score') as Extract<GameEvent, { type: 'score' }>;
    expect(score.at).toEqual(p(1, 1));
    expect(result.scoreDelta).toBeGreaterThan(0);
    expect(specialsLeft(result.state)).toBe(0);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'seed %i 특수 블록 판: 끝난 판은 불변식 성립, 점수 > 0, 특수 블록이 남지 않거나 maxRounds에서 멈춤',
    (seed) => {
      const result = resolveFinale(withSpecials(seed));
      expect(result.valid).toBe(true);
      expect(result.scoreDelta).toBeGreaterThan(0);
      const { board } = result.state;
      expect(board.cells.every((b) => b !== null)).toBe(true);
      expect(findMatches(board)).toEqual([]);
      expect(hasAnyMove(board)).toBe(true);
      const n = rounds(result.steps).length;
      expect(n).toBeLessThanOrEqual(20);
      if (n < 20) expect(specialsLeft(result.state)).toBe(0);
      // 라운드마다 cascade는 0부터 1씩
      let expected = 0;
      for (const e of matchEvents(result.steps)) {
        if (e.cascade === 0) expected = 0;
        expect(e.cascade).toBe(expected++);
      }
    },
  );

  it('같은 상태 → 같은 결과 (결정성)', () => {
    expect(resolveFinale(withSpecials(4))).toEqual(resolveFinale(withSpecials(4)));
  });

  it('maxRounds를 넘지 않는다: 1이면 행 우선 첫 특수 블록 하나만', () => {
    const state = withSpecials(5);
    const firstIndex = state.board.cells.findIndex((b) => b?.special);
    const result = resolveFinale(state, 1);
    expect(rounds(result.steps)).toHaveLength(1);
    const activate = result.steps[0]!.find((e) => e.type === 'activate') as Extract<
      GameEvent,
      { type: 'activate' }
    >;
    expect(activate.at).toEqual({ r: Math.floor(firstIndex / 8), c: firstIndex % 8 });
    expect(activate.depth).toBe(0);
  });
});
