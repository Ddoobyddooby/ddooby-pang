// V2-W2-02: 잠금 — 낙하 고정·구간 리필(spawnTop), 매치·특수 범위로 잠금 해제, 특수 생성 칸 재선택 (PLAN2 5.2·5.3)
import { describe, expect, it } from 'vitest';
import { SCORE } from '../../src/config';
import { isLocked } from '../../src/core/board';
import { createInitialState, resolveFinale, resolveSwap } from '../../src/core/engine';
import { applyGravity, refill } from '../../src/core/gravity';
import { findHint } from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import { specialPosition, unlockedSpecialPosition } from '../../src/core/specials';
import type { Board, CellLayer, GameEvent, GameState, MatchGroup } from '../../src/core/types';
import { obstacleStage } from '../../src/dev/obstacleStage';
import { parseBoard } from '../helpers/board';

/** 문자 그리드 → 층 배열 (L = 잠금, F = 얼음 1겹) */
function layersFrom(rows: string[]): (CellLayer | null)[] {
  return rows.flatMap((row) =>
    [...row].map((ch) => (ch === 'L' ? { lock: true } : ch === 'F' ? { frost: 1 } : null)),
  );
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

describe('core: 잠긴 블록 낙하 고정과 구간 리필 (PLAN2 5.2)', () => {
  // 한 열: R / 빈칸 / 잠긴 Y / 빈칸 / G
  const column = withLayers('R\n.\nY\n.\nG', ['.', '.', 'L', '.', '.']);

  it('잠긴 블록은 그 자리, 위 구간 블록은 잠긴 블록 위에서 멈춘다', () => {
    const { board, event } = applyGravity(column);
    expect(event.moves).toEqual([{ id: 1, from: { r: 0, c: 0 }, to: { r: 1, c: 0 } }]);
    expect(board.cells.map((b) => b?.id ?? null)).toEqual([null, 1, 2, null, 3]);
  });

  it('잠긴 블록 아래 구간은 그 칸이 생성 지점 (spawnTop = 구간 맨 위 행)', () => {
    const filled = refill(applyGravity(column).board, 5, createRng(7));
    expect(
      filled.event.blocks.map(({ at, dropFrom, spawnTop }) => [at.r, dropFrom, spawnTop]),
    ).toEqual([
      [0, 1, 0],
      [3, 1, 3],
    ]);
    expect(filled.board.cells.every((b) => b !== null)).toBe(true);
  });

  it('잠금이 없으면 v0.1처럼 통과하고, 리필 RNG 소비 순서는 같다', () => {
    const plain = { ...column, layers: undefined };
    const fallen = applyGravity(plain);
    expect(fallen.board.cells.map((b) => b?.id ?? null)).toEqual([null, null, 1, 2, 3]);
    const a = refill(fallen.board, 5, createRng(7));
    const b = refill(applyGravity(column).board, 5, createRng(7));
    expect(a.event.blocks.map((x) => [x.dropFrom, x.spawnTop])).toEqual([
      [2, 0],
      [1, 0],
    ]);
    expect(a.event.blocks.map((x) => x.block.color)).toEqual(
      b.event.blocks.map((x) => x.block.color),
    );
    expect(a.rng).toBe(b.rng);
  });

  it('얼음벽과 잠금이 함께 열을 나눈다', () => {
    const board = withLayers('.\n.\nR\n.\n.\nY\n.', ['.', 'F', 'L', '.', '.', '.', '.']);
    const fallen = applyGravity(board);
    expect(fallen.event.moves).toEqual([{ id: 2, from: { r: 5, c: 0 }, to: { r: 6, c: 0 } }]);
    const filled = refill(fallen.board, 5, createRng(1));
    expect(
      filled.event.blocks.map(({ at, dropFrom, spawnTop }) => [at.r, dropFrom, spawnTop]),
    ).toEqual([
      [0, 1, 0],
      [3, 3, 3],
      [4, 2, 3],
      [5, 1, 3],
    ]);
  });
});

describe('core: 매치로 잠금 해제 (PLAN2 5.2·5.3)', () => {
  // (2,2) Y ↔ (2,3) R → 2행 R R R, 가운데 (2,1)이 잠김
  const board = withLayers(
    `
    G B P Y O
    B P Y O G
    R R Y R P
    P O G B Y
    O G B P B
    `,
    ['.....', '.....', '.L...', '.....', '.....'],
  );
  const lockedId = board.cells[2 * 5 + 1]!.id;
  const result = resolveSwap(stateOf(board), { r: 2, c: 2 }, { r: 2, c: 3 });
  const first = result.steps[1]!;

  it('잠긴 블록은 제거되지 않고 잠금만 풀린다 (obstacle 이벤트, remove와 같은 step)', () => {
    expect(result.valid).toBe(true);
    const removed = ofType(first, 'remove')[0]!.blocks;
    expect(removed.map((b) => b.at)).toEqual([
      { r: 2, c: 0 },
      { r: 2, c: 2 },
    ]);
    expect(removed.some((b) => b.id === lockedId)).toBe(false);
    expect(ofType(first, 'obstacle')).toEqual([
      { type: 'obstacle', changes: [{ at: { r: 2, c: 1 }, kind: 'lock', hp: 0 }] },
    ]);
  });

  it('그룹 점수는 그룹 칸 수 기준 + 잠금 해제 1회당 SCORE.obstacle', () => {
    const score = ofType(first, 'score')[0]!;
    expect(score.cascade).toBe(0);
    expect(score.delta).toBe(SCORE.perBlock * 3 + SCORE.obstacle);
  });

  it('잠금 해제 블록은 removedByColor에 들지 않고, clearedObstacles.lock에 센다', () => {
    const removes = result.steps.flatMap((s) => ofType(s, 'remove')).flatMap((e) => e.blocks);
    const total = result.removedByColor.reduce((a, b) => a + b, 0);
    expect(total).toBe(removes.length);
    expect(result.clearedObstacles).toEqual({ lock: 1, frost: 0, jelly: 0 });
    expect(isLocked(result.state.board, { r: 2, c: 1 })).toBe(false);
    expect(result.state.board.layers![2 * 5 + 1]).toBeNull();
  });

  it('잠금 + 젤리 칸은 젤리를 남긴다', () => {
    const layers = board.layers!.slice();
    layers[2 * 5 + 1] = { lock: true, jelly: 1 };
    const r = resolveSwap(stateOf({ ...board, layers }), { r: 2, c: 2 }, { r: 2, c: 3 });
    expect(r.state.board.layers![2 * 5 + 1]).toEqual({ jelly: 1 });
  });
});

describe('core: 특수 효과 범위로 잠금 해제 (PLAN2 5.2)', () => {
  // C ↔ Y: 보드의 Y 전부. (1,2)의 잠긴 Y 줄 블록은 잠금만 풀리고 발동하지 않는다
  const board = withLayers(
    `
    G B P Y O
    B P Y- O G
    R C Y R P
    P O G B Y
    O G B P B
    `,
    ['.....', '..L..', '.....', '.....', '.....'],
  );
  const locked = board.cells[1 * 5 + 2]!;
  const result = resolveSwap(stateOf(board), { r: 2, c: 1 }, { r: 2, c: 2 });
  const first = result.steps[1]!;

  it('컬러 범위에 든 잠긴 블록은 남고, 잠긴 특수 블록은 발동하지 않는다', () => {
    const activations = ofType(first, 'activate');
    expect(activations.map((e) => e.special)).toEqual(['color']);
    expect(activations[0]!.cleared).toContainEqual({ r: 1, c: 2 });
    const removed = ofType(first, 'remove')[0]!.blocks;
    expect(removed.some((b) => b.id === locked.id)).toBe(false);
    expect(ofType(first, 'obstacle')[0]!.changes).toEqual([
      { at: { r: 1, c: 2 }, kind: 'lock', hp: 0 },
    ]);
  });

  it('점수: 특수 제거 수 + 잠금 해제 1회', () => {
    const removed = ofType(first, 'remove')[0]!.blocks;
    expect(ofType(first, 'score')[0]!.delta).toBe(
      removed.length * SCORE.bySpecial + SCORE.obstacle,
    );
  });

  it('컬러 + 특수 조합의 변신은 잠긴 블록을 바꾸지 않는다', () => {
    // (2,2) Y를 Y 줄 블록으로, 잠긴 (1,2)는 일반 Y로: C ↔ Y| → 일반 Y 블록들이 줄 블록이 된다
    const cells = board.cells.slice();
    cells[2 * 5 + 2] = { ...cells[2 * 5 + 2]!, special: 'lineV' };
    cells[1 * 5 + 2] = { id: locked.id, color: locked.color };
    const r = resolveSwap(stateOf({ ...board, cells }), { r: 2, c: 1 }, { r: 2, c: 2 });
    const transform = r.steps[1]!.find((e) => e.type === 'transform');
    expect(
      transform && transform.type === 'transform' && transform.changes.map((c) => c.at),
    ).not.toContainEqual({ r: 1, c: 2 });
    const activated = ofType(r.steps[1]!, 'activate').map((e) => e.at);
    expect(activated).not.toContainEqual({ r: 1, c: 2 });
    expect(ofType(r.steps[1]!, 'obstacle')[0]!.changes.map((c) => c.at)).toContainEqual({
      r: 1,
      c: 2,
    });
  });

  it('마지막 팡은 잠긴 특수 블록을 발동하지 않는다', () => {
    const only = withLayers('R- Y G\nG R Y\nY G R', ['L..', '...', '...']);
    expect(resolveFinale(stateOf(only)).valid).toBe(false);
  });
});

describe('core: 특수 블록 생성 칸 재선택 (PLAN2 5.2)', () => {
  const group: MatchGroup = {
    color: 0,
    cells: [0, 1, 2, 3].map((c) => ({ r: 0, c })),
    maxRunH: 4,
    maxRunV: 0,
    hasIntersection: false,
  };
  const board = (rows: string) => withLayers('R R R R', [rows]);

  it('생성 칸이 잠겼으면 잠기지 않은 칸 중 specialPosition 규칙으로', () => {
    expect(specialPosition(group, [])).toEqual({ r: 0, c: 1 });
    expect(unlockedSpecialPosition(group, [], board('.L..'))).toEqual({ r: 0, c: 2 });
    expect(unlockedSpecialPosition(group, [], board('....'))).toEqual({ r: 0, c: 1 });
  });

  it('스왑 칸이 그룹에 있으면 그 칸 (스왑 칸은 잠기지 않는다)', () => {
    expect(unlockedSpecialPosition(group, [{ r: 0, c: 3 }], board('.L..'))).toEqual({
      r: 0,
      c: 3,
    });
  });

  it('다 잠겼으면 만들지 않는다 (null)', () => {
    expect(unlockedSpecialPosition(group, [], board('LLLL'))).toBeNull();
  });
});

describe('core: 잠금 스테이지 연속 플레이 (결정성·일관성)', () => {
  const stage = obstacleStage();
  const start = (seed: number) =>
    createInitialState({ rows: 8, cols: 8, colors: stage.colors, seed, layers: stage.layers });
  const lockCount = (b: Board) => b.layers?.filter((l) => l?.lock).length ?? 0;

  it.each(['keep', 'explode'] as const)(
    '%s: seed 1~20, 힌트 수 40번: 잠긴 블록은 움직이지 않고, 해제 수·이벤트·집계가 맞는다',
    (mode) => {
      for (let seed = 1; seed <= 20; seed++) {
        let state = start(seed);
        for (let move = 0; move < 40; move++) {
          const before = state.board;
          const hint = findHint(before)!;
          expect(isLocked(before, hint.a) || isLocked(before, hint.b)).toBe(false);
          const result = resolveSwap(state, hint.a, hint.b, mode);
          const after = result.state.board;

          // 끝까지 잠긴 칸은 같은 블록 그대로 (셔플도 건드리지 않는다)
          before.cells.forEach((block, i) => {
            if (before.layers![i]?.lock && after.layers![i]?.lock) {
              expect(after.cells[i]).toBe(block);
            }
          });
          const changes = result.steps
            .flatMap((s) => ofType(s, 'obstacle'))
            .flatMap((e) => e.changes)
            .filter((c) => c.kind === 'lock'); // 얼음벽 피해는 frost.test.ts
          expect(changes.every((c) => c.hp === 0)).toBe(true);
          expect(result.clearedObstacles.lock).toBe(changes.length);
          expect(lockCount(before) - lockCount(after)).toBe(changes.length);
          for (const step of result.steps) {
            const unlocked = ofType(step, 'obstacle').flatMap((e) =>
              e.changes.filter((c) => c.kind === 'lock').map((c) => c.at),
            );
            const removed = ofType(step, 'remove').flatMap((e) => e.blocks.map((b) => b.at));
            for (const p of unlocked) expect(removed).not.toContainEqual(p);
            for (const { at, spawnTop } of ofType(step, 'refill').flatMap((e) => e.blocks)) {
              expect(spawnTop).toBeLessThanOrEqual(at.r);
            }
          }
          // removedByColor = 제거된 색 블록 수 (잠금 해제 블록·컬러 블록 제외)
          const colorOf = new Map(before.cells.flatMap((b) => (b ? [[b.id, b.color]] : [])));
          for (const e of result.steps.flat()) {
            if (e.type === 'create') colorOf.set(e.block.id, e.block.color);
            if (e.type === 'refill')
              e.blocks.forEach((x) => colorOf.set(x.block.id, x.block.color));
          }
          const counted = result.steps
            .flatMap((s) => ofType(s, 'remove'))
            .flatMap((e) => e.blocks)
            .filter((b) => colorOf.get(b.id) !== null).length;
          expect(result.removedByColor.reduce((a, b) => a + b, 0)).toBe(counted);
          state = result.state;
        }
      }
    },
  );

  it('같은 seed + 같은 입력 → 같은 결과 (clearedObstacles 포함)', () => {
    const play = (seed: number) => {
      let state = start(seed);
      const results = [];
      for (let move = 0; move < 30; move++) {
        const hint = findHint(state.board)!;
        const result = resolveSwap(state, hint.a, hint.b);
        results.push(result);
        state = result.state;
      }
      return results;
    };
    expect(play(9)).toEqual(play(9));
    const unlocks = play(9).reduce((sum, r) => sum + r.clearedObstacles.lock, 0);
    expect(unlocks).toBeGreaterThan(0);
  });

  it('장애물 없는 보드는 obstacle 이벤트가 없고 spawnTop은 항상 0', () => {
    let state = createInitialState({ rows: 8, cols: 8, colors: 5, seed: 3 });
    for (let move = 0; move < 30; move++) {
      const hint = findHint(state.board)!;
      const result = resolveSwap(state, hint.a, hint.b);
      expect(result.steps.flat().some((e) => e.type === 'obstacle')).toBe(false);
      expect(result.clearedObstacles).toEqual({ lock: 0, frost: 0, jelly: 0 });
      for (const e of result.steps.flat()) {
        if (e.type === 'refill') expect(e.blocks.every((b) => b.spawnTop === 0)).toBe(true);
      }
      expect(result.state.board.layers).toBeUndefined();
      state = result.state;
    }
  });
});
