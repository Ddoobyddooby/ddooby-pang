// V2-W2-04: 젤리 — 그 칸의 블록이 제거될 때 step당 1겹, 잠금만 풀리면 그대로 (PLAN2 5.2·5.3)
import { describe, expect, it } from 'vitest';
import { SCORE } from '../../src/config';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import type { Board, CellLayer, GameEvent, GameState } from '../../src/core/types';
import { obstacleStage } from '../../src/dev/obstacleStage';
import { parseBoard } from '../helpers/board';

/** 문자 그리드 → 층 배열 (j = 젤리 1겹, J = 젤리 2겹, K = 잠금 + 젤리 1겹, L = 잠금) */
function layersFrom(rows: string[]): (CellLayer | null)[] {
  const defs: Record<string, CellLayer> = {
    j: { jelly: 1 },
    J: { jelly: 2 },
    K: { lock: true, jelly: 1 },
    L: { lock: true },
  };
  return rows.flatMap((row) => [...row].map((ch) => defs[ch] ?? null));
}

const withLayers = (text: string, rows: string[]): Board => ({
  ...parseBoard(text),
  layers: layersFrom(rows),
});

const stateOf = (board: Board, colors = 5): GameState => ({
  board,
  rngState: createRng(42),
  colors,
});

const ofType = <T extends GameEvent['type']>(step: readonly GameEvent[], type: T) =>
  step.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const jellyChanges = (step: readonly GameEvent[]) =>
  ofType(step, 'obstacle')
    .flatMap((e) => e.changes)
    .filter((c) => c.kind === 'jelly');

const jellyAt = (board: Board, r: number, c: number) =>
  board.layers?.[r * board.cols + c]?.jelly ?? 0;

/** 모든 step에서 0겹이 된 젤리 수 = clearedObstacles.jelly */
const zeroJelly = (steps: readonly (readonly GameEvent[])[]) =>
  steps.flatMap(jellyChanges).filter((c) => c.hp === 0).length;

// (2,2) Y ↔ (2,3) R → 2행 (2,0)~(2,2) R R R (lock.test.ts와 같은 보드)
const MATCH_BOARD = `
  G B P Y O
  B P Y O G
  R R Y R P
  P O G B Y
  O G B P B
`;

describe('core: 매치로 젤리 감소 (PLAN2 5.2)', () => {
  const board = withLayers(MATCH_BOARD, ['.....', '.....', 'jJ.j.', '.....', '.....']);
  const result = resolveSwap(stateOf(board), { r: 2, c: 2 }, { r: 2, c: 3 });
  const first = result.steps[1]!;

  it('제거된 칸의 젤리만 1겹 감소: 1겹 → 0, 2겹 → 1 (remove와 같은 step, 행 우선)', () => {
    expect(result.valid).toBe(true);
    expect(jellyChanges(first)).toEqual([
      { at: { r: 2, c: 0 }, kind: 'jelly', hp: 0 },
      { at: { r: 2, c: 1 }, kind: 'jelly', hp: 1 },
    ]);
  });

  it('매치에 들지 않은 칸 (2,3)의 젤리는 첫 step에서 그대로', () => {
    expect(jellyChanges(first).some((c) => c.at.r === 2 && c.at.c === 3)).toBe(false);
  });

  it('1겹마다 SCORE.obstacle (그룹 점수는 칸 수 기준)', () => {
    expect(ofType(first, 'score')[0]!.delta).toBe(SCORE.perBlock * 3 + 2 * SCORE.obstacle);
  });

  it('clearedObstacles.jelly는 0겹이 된 칸 수 (연쇄 포함), 층은 0겹이면 비운다', () => {
    expect(result.clearedObstacles.jelly).toBe(zeroJelly(result.steps));
    expect(result.clearedObstacles.jelly).toBeGreaterThanOrEqual(1);
    expect(result.state.board.layers![2 * 5 + 0]).toBeNull();
  });

  it('젤리는 칸에 붙어 있다: 블록이 떨어져도 층은 그 자리', () => {
    // 첫 step 뒤 (2,1)은 1겹. 연쇄에서 다시 제거되지 않았다면 그대로 1겹
    const later = result.steps.slice(2).flatMap(jellyChanges);
    const hitAgain = later.filter((c) => c.at.r === 2 && c.at.c === 1).length;
    expect(jellyAt(result.state.board, 2, 1)).toBe(Math.max(0, 1 - hitAgain));
  });
});

describe('core: 같은 step에 한 칸은 1겹만 (PLAN2 5.2)', () => {
  // (2,2) Y ↔ (2,3) R → R R- R 매치, R- 가 2행 전체를 지운다. (2,1)은 매치 + 줄 범위에 함께 든다
  const board = withLayers(
    `
    G B P Y O
    B P Y O G
    R R- Y R P
    P O G B Y
    O G B P B
    `,
    ['.....', '.....', '.J..J', '.....', '.....'],
  );
  const result = resolveSwap(stateOf(board), { r: 2, c: 2 }, { r: 2, c: 3 });
  const first = result.steps[1]!;

  it('매치와 특수 범위가 겹친 칸도 1겹, 특수 범위만 든 칸 (2,4)도 1겹', () => {
    expect(ofType(first, 'activate').map((e) => e.special)).toEqual(['lineH']);
    expect(jellyChanges(first)).toEqual([
      { at: { r: 2, c: 1 }, kind: 'jelly', hp: 1 },
      { at: { r: 2, c: 4 }, kind: 'jelly', hp: 1 },
    ]);
  });

  it('모든 step에서 한 칸은 step마다 최대 한 번', () => {
    for (const step of result.steps) {
      const at = jellyChanges(step).map((c) => `${c.at.r},${c.at.c}`);
      expect(new Set(at).size).toBe(at.length);
    }
  });
});

describe('core: 잠금 + 젤리 (PLAN2 5.2)', () => {
  const board = withLayers(MATCH_BOARD, ['.....', '.....', '.K...', '.....', '.....']);
  const result = resolveSwap(stateOf(board), { r: 2, c: 2 }, { r: 2, c: 3 });
  const first = result.steps[1]!;

  it('잠금만 풀린 블록은 제거가 아니므로 젤리 피해 없음', () => {
    expect(ofType(first, 'obstacle')[0]!.changes).toEqual([
      { at: { r: 2, c: 1 }, kind: 'lock', hp: 0 },
    ]);
    expect(result.state.board.layers![2 * 5 + 1]).toEqual({ jelly: 1 });
    expect(ofType(first, 'score')[0]!.delta).toBe(SCORE.perBlock * 3 + SCORE.obstacle);
  });

  it('잠금이 풀린 뒤 그 칸의 블록이 제거되면 젤리 감소', () => {
    // 같은 배치에 풀린 뒤의 층({jelly: 1})을 두고 같은 수를 둔다
    const layers = board.layers!.slice();
    layers[2 * 5 + 1] = result.state.board.layers![2 * 5 + 1]!;
    const next = resolveSwap(stateOf({ ...board, layers }), { r: 2, c: 2 }, { r: 2, c: 3 });
    expect(jellyChanges(next.steps[1]!)).toEqual([{ at: { r: 2, c: 1 }, kind: 'jelly', hp: 0 }]);
    expect(next.clearedObstacles.lock).toBe(0);
    expect(next.clearedObstacles.jelly).toBeGreaterThanOrEqual(1);
  });
});

describe('core: 무지개(컬러) 블록 범위 (PLAN2 5.2)', () => {
  const text = `
    G B P Y O
    B P Y O G
    R C Y R P
    P O G B Y
    O G B P B
  `;

  it('컬러 ↔ Y: 지워진 Y 칸의 젤리만 감소, 다른 색 칸은 그대로', () => {
    // Y는 (0,3) (1,2) (2,2) (3,4). (0,0) G는 범위 밖
    const board = withLayers(text, ['j..j.', '..J..', '..j..', '....j', '.....']);
    const result = resolveSwap(stateOf(board), { r: 2, c: 1 }, { r: 2, c: 2 });
    expect(jellyChanges(result.steps[1]!)).toEqual([
      { at: { r: 0, c: 3 }, kind: 'jelly', hp: 0 },
      { at: { r: 1, c: 2 }, kind: 'jelly', hp: 1 },
      { at: { r: 2, c: 2 }, kind: 'jelly', hp: 0 },
      { at: { r: 3, c: 4 }, kind: 'jelly', hp: 0 },
    ]);
    expect(jellyChanges(result.steps[1]!).some((c) => c.at.r === 0 && c.at.c === 0)).toBe(false);
  });

  it('컬러 ↔ 컬러: 보드 전체가 지워져 모든 젤리 칸이 1겹씩 (2겹은 1로)', () => {
    const both = text.replace('R C Y', 'R C C');
    const board = withLayers(both, ['jjjjj', 'jjjjj', 'JJJJJ', 'jjjjj', 'jjjjj']);
    const result = resolveSwap(stateOf(board), { r: 2, c: 1 }, { r: 2, c: 2 });
    const changes = jellyChanges(result.steps[1]!);
    expect(changes).toHaveLength(25);
    expect(changes.filter((c) => c.hp === 1).map((c) => c.at.r)).toEqual([2, 2, 2, 2, 2]);
    expect(result.clearedObstacles.jelly).toBe(zeroJelly(result.steps));
  });
});

describe('core: 젤리 스테이지 연속 플레이 (결정성·일관성)', () => {
  const stage = obstacleStage();
  const start = () =>
    createInitialState({
      rows: stage.rows,
      cols: stage.cols,
      colors: stage.colors,
      seed: stage.seed!,
      layers: stage.layers,
    });
  const jellyCells = (board: Board) => board.layers!.filter((l) => l?.jelly).length;

  it('지운 젤리 칸 누적 = 처음 젤리 칸 - 남은 젤리 칸, 겹수는 늘지 않는다', () => {
    let state = start();
    const initial = jellyCells(state.board);
    let cleared = 0;
    for (let move = 0; move < 40; move++) {
      const before = state.board.layers!;
      const hint = findHint(state.board)!;
      const result = resolveSwap(state, hint.a, hint.b);
      state = result.state;
      cleared += result.clearedObstacles.jelly;
      state.board.layers!.forEach((l, i) => {
        expect(l?.jelly ?? 0).toBeLessThanOrEqual(before[i]?.jelly ?? 0);
      });
      expect(cleared).toBe(initial - jellyCells(state.board));
    }
    expect(cleared).toBeGreaterThan(0);
  });

  it('같은 seed + 같은 입력 → 같은 결과 (젤리 층·clearedObstacles 포함)', () => {
    const play = () => {
      let state = start();
      const totals: unknown[] = [];
      for (let move = 0; move < 30; move++) {
        const hint = findHint(state.board)!;
        const result = resolveSwap(state, hint.a, hint.b);
        state = result.state;
        totals.push(result.clearedObstacles);
      }
      return { state, totals };
    };
    expect(play()).toEqual(play());
  });
});
