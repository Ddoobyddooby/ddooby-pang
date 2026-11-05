// 특수 블록 조합 (SPEC v0.2 3절, PLAN2 3.1·3.2·3.4)
import { describe, expect, it } from 'vitest';
import { SCORE } from '../../src/config';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findMatches } from '../../src/core/matcher';
import { findHint, hasAnyMove, isValidSwap } from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import { blastArea, comboArea, comboKind } from '../../src/core/specials';
import type {
  Board,
  ComboKind,
  GameEvent,
  GameState,
  Pos,
  ResolveResult,
  SpecialKind,
} from '../../src/core/types';
import type { StageDef } from '../../src/data/stageSchema';
import { StoryMode } from '../../src/modes/StoryMode';
import { EventTracker } from '../../src/view/eventTracker';
import { parseBoard } from '../helpers/board';

const p = (r: number, c: number): Pos => ({ r, c });
const key = (q: Pos) => `${q.r},${q.c}`;
const keys = (ps: readonly Pos[]) => ps.map(key);

const CHARS = ['R', 'Y', 'G', 'B', 'P'];

/**
 * rows×cols 보드. 기본 칸 색은 (c + 2r) % 5라 가로·세로로 같은 색이 이어지지 않는다 (매치 0).
 * put: "r,c" → 표기 (예: 'R-', 'C')
 */
function boardText(rows: number, cols: number, put: Record<string, string> = {}): string {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(put[`${r},${c}`] ?? CHARS[(c + 2 * r) % 5]!);
    lines.push(row.join(' '));
  }
  return lines.join('\n');
}

function stateOf(text: string, seed = 1): GameState {
  return { board: parseBoard(text), rngState: createRng(seed), colors: 5 };
}

type ComboEvent = Extract<GameEvent, { type: 'combo' }>;
type ActivateEvent = Extract<GameEvent, { type: 'activate' }>;

function comboOf(result: ResolveResult): ComboEvent {
  const step = result.steps[1]!;
  expect(step).toHaveLength(1); // 독립 step에 combo 하나만
  expect(step[0]!.type).toBe('combo');
  return step[0] as ComboEvent;
}

/** 조합 다음 step (첫 제거 step) */
function blastStep(result: ResolveResult) {
  const step = result.steps[2]!;
  const remove = step.find((e) => e.type === 'remove')!;
  return {
    types: [...new Set(step.map((e) => e.type))],
    removed: remove.type === 'remove' ? remove.blocks : [],
    activate: step
      .filter((e): e is ActivateEvent => e.type === 'activate')
      .map((e) => `${e.special}@${key(e.at)}#${e.depth}`),
    score: step.find((e) => e.type === 'score'),
  };
}

/** 7×7에서 at 기준 기대 범위 */
function area7(test: (dr: number, dc: number) => boolean, at: Pos): string[] {
  const out: string[] = [];
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++)
      if (test(Math.abs(r - at.r), Math.abs(c - at.c))) out.push(`${r},${c}`);
  return out;
}

/** 이벤트만 보고 id 위치를 따라간 결과가 core 최종 보드와 같은가 (DEV view ↔ board 대조와 같은 검사) */
function expectReplayMatches(before: Board, result: ResolveResult) {
  const tracker = new EventTracker(before);
  for (const step of result.steps) for (const e of step) tracker.apply(e);
  const want = new Map<string, number>();
  result.state.board.cells.forEach(
    (b, i) => b && want.set(`${Math.floor(i / before.cols)},${i % before.cols}`, b.id),
  );
  expect(tracker.snapshot()).toEqual(want);
}

function expectFinished(result: ResolveResult) {
  const board = result.state.board;
  expect(board.cells.every((b) => b !== null)).toBe(true);
  expect(findMatches(board)).toEqual([]);
  expect(hasAnyMove(board)).toBe(true);
}

describe('comboKind', () => {
  it.each<[SpecialKind, SpecialKind, ComboKind]>([
    ['lineH', 'lineV', 'lineLine'],
    ['lineH', 'lineH', 'lineLine'],
    ['lineV', 'bomb', 'lineBomb'],
    ['bomb', 'bomb', 'bombBomb'],
    ['color', 'lineH', 'colorLine'],
    ['color', 'bomb', 'colorBomb'],
    ['color', 'super', 'colorSuper'],
    ['color', 'color', 'colorColor'],
    ['super', 'lineV', 'superAny'],
    ['super', 'bomb', 'superAny'],
    ['super', 'super', 'superAny'],
  ])('%s + %s → %s (순서 무관)', (x, y, kind) => {
    expect(comboKind(x, y)).toBe(kind);
    expect(comboKind(y, x)).toBe(kind);
  });
});

describe('resolveSwap: 특수 블록 조합 (색이 달라도, 매치가 없어도)', () => {
  // (3,2)와 (3,3)에 서로 다른 색 특수 블록. a = (3,2) → b = (3,3)으로 끌면 at = (3,3)
  const pair = (left: string, right: string, extra: Record<string, string> = {}) =>
    stateOf(boardText(7, 7, { '3,2': left, '3,3': right, ...extra }));
  const A = p(3, 2);
  const B = p(3, 3);

  it('서로 다른 색 특수 블록 둘 스왑은 valid이고 가능한 수로 센다', () => {
    const state = pair('R-', 'Y|');
    expect(findMatches(state.board)).toEqual([]);
    expect(isValidSwap(state.board, A, B)).toBe(true);
    const result = resolveSwap(state, A, B);
    expect(result.valid).toBe(true);
  });

  it('step 순서: [swap] → [combo] → [match, remove, score] → [fall, refill]', () => {
    const result = resolveSwap(pair('R-', 'Y|'), A, B);
    expect(result.steps[0]).toEqual([{ type: 'swap', a: A, b: B }]);
    expect(comboOf(result).type).toBe('combo');
    expect(result.steps[2]!.map((e) => e.type)).toEqual(['match', 'remove', 'score']);
    expect(result.steps[2]![0]).toEqual({ type: 'match', groups: [], cascade: 0 });
    expect(result.steps[3]!.map((e) => e.type)).toEqual(['fall', 'refill']);
  });

  it('lineLine: at 행 + 열, combo 필드, 점수는 bySpecial 20점씩', () => {
    const result = resolveSwap(pair('R-', 'Y|'), A, B);
    const combo = comboOf(result);
    const want = area7((dr, dc) => dr === 0 || dc === 0, B);
    expect(combo).toEqual({
      type: 'combo',
      combo: 'lineLine',
      at: B,
      partner: A,
      cleared: want.map((k) => p(+k.split(',')[0]!, +k.split(',')[1]!)),
    });
    const step = blastStep(result);
    expect(step.activate).toEqual([]); // 조합한 두 블록은 activate로 다시 나오지 않는다
    expect(keys(step.removed.map((b) => b.at))).toEqual(want);
    expect(step.removed.every((b) => b.bySpecial)).toBe(true);
    expect(step.score).toMatchObject({ delta: 13 * SCORE.bySpecial, cascade: 0, at: B });
  });

  it('lineLine b → a: at이 a 칸이 된다', () => {
    const result = resolveSwap(pair('R-', 'Y|'), B, A);
    const combo = comboOf(result);
    expect(combo).toMatchObject({ combo: 'lineLine', at: A, partner: B });
    expect(keys(combo.cleared)).toEqual(area7((dr, dc) => dr === 0 || dc === 0, A));
  });

  it('lineBomb: at 기준 3행 + 3열 (양방향 같은 종류)', () => {
    for (const [a, b, at] of [
      [A, B, B],
      [B, A, A],
    ] as const) {
      const result = resolveSwap(pair('R|', 'Y*'), a, b);
      const combo = comboOf(result);
      expect(combo.combo).toBe('lineBomb');
      const want = area7((dr, dc) => dr <= 1 || dc <= 1, at);
      expect(keys(combo.cleared)).toEqual(want);
      expect(keys(blastStep(result).removed.map((x) => x.at))).toEqual(want);
    }
  });

  it('bombBomb: at 기준 5×5 한 번', () => {
    const result = resolveSwap(pair('R*', 'Y*'), A, B);
    const combo = comboOf(result);
    expect(combo.combo).toBe('bombBomb');
    const want = area7((dr, dc) => dr <= 2 && dc <= 2, B);
    expect(want).toHaveLength(25);
    expect(keys(combo.cleared)).toEqual(want);
    expect(keys(blastStep(result).removed.map((x) => x.at))).toEqual(want);
    expect(blastStep(result).score).toMatchObject({ delta: 25 * SCORE.bySpecial });
  });

  it('bombBomb 모서리: 보드 밖은 잘린다', () => {
    const state = stateOf(boardText(7, 7, { '0,0': 'R*', '0,1': 'Y*' }));
    const combo = comboOf(resolveSwap(state, p(0, 0), p(0, 1)));
    // at (0,1): 0~2행 × 0~3열
    expect(keys(combo.cleared)).toEqual(area7((dr, dc) => dr <= 2 && dc <= 2, p(0, 1)));
    expect(combo.cleared).toHaveLength(12);
  });

  it('lineLine 모서리: (6,6)에서 행 + 열 13칸', () => {
    const state = stateOf(boardText(7, 7, { '6,5': 'R-', '6,6': 'Y-' }));
    const combo = comboOf(resolveSwap(state, p(6, 5), p(6, 6)));
    expect(keys(combo.cleared)).toEqual(area7((dr, dc) => dr === 0 || dc === 0, p(6, 6)));
  });

  const SUPER_AREA = (dr: number, dc: number) => (dr <= 2 && dc <= 2) || dr === 0 || dc === 0;

  it('superAny: 슈퍼 범위 ∪ 상대 효과, 어느 쪽을 끌어도 같은 종류', () => {
    for (const partner of ['Y-', 'Y|', 'Y*', 'Y+']) {
      for (const [a, b, at] of [
        [A, B, B],
        [B, A, A],
      ] as const) {
        const result = resolveSwap(pair('R+', partner), a, b);
        const combo = comboOf(result);
        expect(combo.combo).toBe('superAny');
        const want = area7(SUPER_AREA, at);
        expect(keys(combo.cleared), `${partner} ${key(a)}→${key(b)}`).toEqual(want);
        expect(keys(blastStep(result).removed.map((x) => x.at))).toEqual(want);
      }
    }
  });

  it('superAny + 세로·가로 줄: 상대 방향은 줄 블록 자기 종류 (끄는 방향과 무관)', () => {
    // 세로로 붙은 슈퍼 (2,3)와 가로줄 (3,3). 어느 쪽을 끌어도 가로줄은 가로 그대로 (at 행 전체)
    const board = parseBoard(boardText(7, 7, { '2,3': 'R+', '3,3': 'Y-' }));
    const line = board.cells[3 * 7 + 3]!;
    for (const at of [p(3, 3), p(2, 3)]) {
      const area = comboArea('superAny', at, board, line);
      const row = keys(blastArea('lineH', at, board));
      expect(keys(area)).toEqual(expect.arrayContaining(row));
      expect(keys(area)).toEqual(keys(blastArea('super', at, board)));
    }
    const down = comboOf(
      resolveSwap(stateOf(boardText(7, 7, { '2,3': 'R+', '3,3': 'Y-' })), p(2, 3), p(3, 3)),
    );
    const up = comboOf(
      resolveSwap(stateOf(boardText(7, 7, { '2,3': 'R+', '3,3': 'Y-' })), p(3, 3), p(2, 3)),
    );
    expect(keys(down.cleared)).toEqual(area7(SUPER_AREA, p(3, 3)));
    expect(keys(up.cleared)).toEqual(area7(SUPER_AREA, p(2, 3)));
  });

  it('범위 안 다른 특수 블록은 차례 1부터 연쇄 발동, 조합한 두 블록은 재발동하지 않는다', () => {
    // 행 3의 (3,6) 폭탄 → 차례 1. 그 3×3에 걸린 (2,5) 세로줄 → 차례 2
    const result = resolveSwap(pair('R-', 'Y|', { '3,6': 'G*', '2,5': 'B|' }), A, B);
    const step = blastStep(result);
    expect(step.types).toEqual(['match', 'activate', 'remove', 'score']);
    expect(step.activate).toEqual(['bomb@3,6#1', 'lineV@2,5#2']);
    expect(step.activate.some((s) => s.includes(`@${key(A)}#`) || s.includes(`@${key(B)}#`))).toBe(
      false,
    );
    // 행 3 + 열 3 + 폭탄 3×3 + 열 5
    const removed = new Set(keys(step.removed.map((x) => x.at)));
    for (const k of [
      ...area7((dr, dc) => dr === 0 || dc === 0, B),
      ...area7((dr, dc) => dr <= 1 && dc <= 1, p(3, 6)),
      ...area7((_dr, dc) => dc === 0, p(2, 5)),
    ])
      expect(removed.has(k), k).toBe(true);
    expect(step.removed.every((x) => x.bySpecial)).toBe(true);
    // combo.cleared에는 휘말린 발동 범위가 들어가지 않는다
    expect(comboOf(result).cleared).toHaveLength(13);
  });

  it('끝난 보드는 불변식 성립, 이벤트 재생이 보드와 맞는다 (8개 범주)', () => {
    for (const [l, r] of [
      ['R-', 'Y|'],
      ['R-', 'Y*'],
      ['R*', 'Y*'],
      ['C', 'Y-'],
      ['C', 'Y*'],
      ['C', 'Y+'],
      ['C', 'C'],
      ['R+', 'Y*'],
    ]) {
      const state = pair(l!, r!);
      const result = resolveSwap(state, A, B);
      expect(result.valid).toBe(true);
      expectFinished(result);
      expectReplayMatches(state.board, result);
    }
  });
});

describe('resolveSwap: 컬러(무지개) + 특수 조합은 v0.1 결과 앞에 combo만', () => {
  const A = p(3, 2);
  const B = p(3, 3);
  const pair = (left: string, right: string) =>
    stateOf(boardText(7, 7, { '3,2': left, '3,3': right }));

  it.each<[string, string, ComboKind]>([
    ['C', 'Y-', 'colorLine'],
    ['C', 'Y*', 'colorBomb'],
    ['C', 'Y+', 'colorSuper'],
    ['C', 'C', 'colorColor'],
    ['Y|', 'C', 'colorLine'],
  ])('%s ↔ %s → %s', (left, right, kind) => {
    const state = pair(left, right);
    const result = resolveSwap(state, A, B);
    const combo = comboOf(result);
    expect(combo).toMatchObject({ combo: kind, at: B, partner: A });

    // 다음 step은 v0.1 컬러 발동 그대로: 컬러 블록 칸에서 차례 0
    const colorAt = left === 'C' ? B : A; // 컬러 블록이 스왑으로 옮겨 간 칸 (둘 다 컬러면 b)
    const step = blastStep(result);
    expect(step.activate[0]).toBe(`color@${key(colorAt)}#0`);
    expect(step.types.includes('transform')).toBe(kind !== 'colorColor');

    // combo.cleared = 컬러의 최초 대상 칸 = 첫 activate(컬러)의 cleared
    const first = result.steps[2]!.find((e): e is ActivateEvent => e.type === 'activate')!;
    expect(combo.cleared).toEqual(first.cleared);
    if (kind === 'colorColor') expect(combo.cleared).toHaveLength(49);
  });
});

// 컬러 + 줄·폭탄·슈퍼·컬러의 값(변신·차례·점수)이 v0.1과 같은지는 engine.test.ts의 기존 테스트가 그대로 확인한다
describe('회귀: 조합이 아닌 스왑은 v0.1 그대로', () => {
  it('한쪽만 특수 블록이고 매치가 없으면 무효 (swap → swapBack)', () => {
    const state = stateOf(boardText(7, 7, { '3,2': 'R-' }));
    const result = resolveSwap(state, p(3, 2), p(3, 3));
    expect(result.valid).toBe(false);
    expect(result.steps.map((s) => s.map((e) => e.type))).toEqual([['swap'], ['swapBack']]);
    expect(isValidSwap(state.board, p(3, 2), p(3, 3))).toBe(false);
  });

  it('한쪽만 특수 블록 + 매치는 combo 없이 매치·발동', () => {
    const state = stateOf(`
      R- Y R R
      G  B G B
      Y  G B G
    `);
    const result = resolveSwap(state, p(0, 0), p(0, 1));
    expect(result.valid).toBe(true);
    expect(result.steps.flat().some((e) => e.type === 'combo')).toBe(false);
    expect(result.steps[1]!.map((e) => e.type)).toContain('match');
  });

  it('일반 매치에는 combo가 없다', () => {
    const state = stateOf(`
      R R Y B
      G B R G
      Y G B Y
      B Y G R
    `);
    const result = resolveSwap(state, p(0, 2), p(1, 2));
    expect(result.valid).toBe(true);
    expect(result.steps.flat().some((e) => e.type === 'combo')).toBe(false);
    expect(result.steps[1]![0]).toMatchObject({ type: 'match', cascade: 0 });
  });

  it('컬러 + 일반 블록에는 combo가 없다', () => {
    const result = resolveSwap(stateOf(boardText(7, 7, { '3,2': 'C' })), p(3, 2), p(3, 3));
    expect(result.steps.flat().some((e) => e.type === 'combo')).toBe(false);
  });
});

describe('조합과 모드·결정성', () => {
  it('조합도 이동 1회 (StoryMode)', () => {
    const stage: StageDef = {
      id: 7,
      rows: 7,
      cols: 7,
      colors: 5,
      moves: 5,
      goals: [{ type: 'score', target: 100000 }],
      stars: [100000, 200000, 300000],
    };
    const mode = new StoryMode(stage);
    const result = resolveSwap(
      stateOf(boardText(7, 7, { '3,2': 'R*', '3,3': 'Y*' })),
      p(3, 2),
      p(3, 3),
    );
    mode.onResolve(result);
    expect(mode.movesLeft()).toBe(4);
    expect(mode.score()).toBe(result.scoreDelta);
  });

  it('같은 seed + 같은 스왑 목록(조합 섞기) → 같은 점수·보드', () => {
    function play(seed: number) {
      let state = createInitialState({ rows: 8, cols: 8, colors: 5, seed });
      // 특수 블록 쌍을 놓는다 (?specials=pairs와 같은 방식: 색은 그대로, 컬러만 null)
      const put: [Pos, SpecialKind][] = [
        [p(1, 1), 'lineH'],
        [p(1, 2), 'lineV'],
        [p(5, 5), 'bomb'],
        [p(5, 6), 'bomb'],
        [p(6, 1), 'super'],
        [p(6, 2), 'lineH'],
      ];
      const cells = state.board.cells.slice();
      for (const [q, special] of put) {
        const block = cells[q.r * 8 + q.c]!;
        cells[q.r * 8 + q.c] = {
          id: block.id,
          color: special === 'color' ? null : block.color,
          special,
        };
      }
      state = { ...state, board: { ...state.board, cells } };
      let score = 0;
      let combos = 0;
      // 정한 쌍을 차례로 스왑하고, 앞 조합의 연쇄로 쌍이 흩어졌으면 그 차례는 힌트 수를 둔다
      const swaps: [Pos, Pos][] = [
        [p(5, 5), p(5, 6)],
        [p(1, 1), p(1, 2)],
        [p(6, 1), p(6, 2)],
      ];
      for (let i = 0; i < 12; i++) {
        const [a, b] = swaps[i] ?? [];
        const move = a && b && isValidSwap(state.board, a, b) ? { a, b } : findHint(state.board)!;
        const result = resolveSwap(state, move.a, move.b);
        expect(result.valid).toBe(true);
        if (result.steps[1]?.[0]?.type === 'combo') combos++;
        score += result.scoreDelta;
        state = result.state;
      }
      return { score, state, combos };
    }
    for (const seed of [1, 7, 42]) {
      const one = play(seed);
      const two = play(seed);
      expect(one.score).toBe(two.score);
      expect(one.state).toEqual(two.state);
      expect(one.combos).toBeGreaterThan(0);
      expect(one.score).toBeGreaterThan(0);
    }
  });
});
