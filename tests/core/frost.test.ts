// V2-W2-03: 얼음벽 — 이웃 매치·특수 범위로 step당 1겹, 0겹이면 빈칸 → 같은 resolve에서 낙하·리필 (PLAN2 5.2·5.3)
import { describe, expect, it } from 'vitest';
import { SCORE } from '../../src/config';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import { cascadeMultiplier } from '../../src/core/scoring';
import type { Board, CellLayer, GameEvent, GameState } from '../../src/core/types';
import { obstacleStage } from '../../src/dev/obstacleStage';
import { parseBoard } from '../helpers/board';

/** 문자 그리드 → 층 배열 (1~3 = 얼음벽 겹수, L = 잠금) */
function layersFrom(rows: string[]): (CellLayer | null)[] {
  return rows.flatMap((row) =>
    [...row].map((ch) =>
      ch === 'L'
        ? { lock: true }
        : ch >= '1' && ch <= '3'
          ? { frost: Number(ch) as 1 | 2 | 3 }
          : null,
    ),
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

const frostChanges = (step: readonly GameEvent[]) =>
  ofType(step, 'obstacle')
    .flatMap((e) => e.changes)
    .filter((c) => c.kind === 'frost');

const frostAt = (board: Board, r: number, c: number) =>
  board.layers?.[r * board.cols + c]?.frost ?? 0;

describe('core: 이웃 매치로 얼음벽 1겹 감소 (PLAN2 5.2)', () => {
  // (2,3) Y ↔ (3,3) R → 2행 (2,1)~(2,3) R R R.
  // 상 (1,2), 하 (3,1), 좌 (2,0), 우 (2,4)는 이웃, (1,0)·(3,4)는 대각선만 닿는다. 모두 2겹
  const text = `
    G B P O G
    . Y . P B
    . R R Y .
    P . O R .
    B G B P O
  `;
  const grid = ['.....', '2.2..', '2...2', '.2..2', '.....'];
  const result = resolveSwap(stateOf(withLayers(text, grid)), { r: 2, c: 3 }, { r: 3, c: 3 });
  const first = result.steps[1]!;

  it('상하좌우 이웃만 1겹 감소, 대각선은 그대로 (obstacle 이벤트는 remove와 같은 step, 행 우선)', () => {
    expect(result.valid).toBe(true);
    expect(ofType(first, 'remove')).toHaveLength(1);
    expect(frostChanges(first)).toEqual([
      { at: { r: 1, c: 2 }, kind: 'frost', hp: 1 },
      { at: { r: 2, c: 0 }, kind: 'frost', hp: 1 },
      { at: { r: 2, c: 4 }, kind: 'frost', hp: 1 },
      { at: { r: 3, c: 1 }, kind: 'frost', hp: 1 },
    ]);
  });

  it('1겹마다 SCORE.obstacle을 더한다 (그룹 점수는 칸 수 기준)', () => {
    const score = ofType(first, 'score')[0]!;
    expect(score.delta).toBe(SCORE.perBlock * 3 + 4 * SCORE.obstacle);
  });

  it('깨지지 않은 얼음벽은 clearedObstacles에 들지 않고 칸은 계속 비어 있다', () => {
    const later = result.steps.slice(2).flatMap(frostChanges);
    const zeros = [...frostChanges(first), ...later].filter((c) => c.hp === 0).length;
    expect(result.clearedObstacles.frost).toBe(zeros);
    const board = result.state.board;
    board.layers!.forEach((layer, i) => {
      if (layer?.frost) expect(board.cells[i]).toBeNull();
    });
  });
});

describe('core: 한 step에 얼음벽 칸당 최대 1겹', () => {
  it('이웃 매치 블록이 여럿이어도 1겹 (L자 그룹이 (1,1)의 좌·하를 둘 다 지운다)', () => {
    // (2,0) Y ↔ (3,0) R → 0열 R R R + 2행 R R R (L자 5칸, 폭탄 생성)
    const board = withLayers(
      `
      R B P O G
      R . G P B
      Y R R O P
      R G B Y O
      B P O G Y
      `,
      ['.....', '.3...', '.....', '.....', '.....'],
    );
    const result = resolveSwap(stateOf(board), { r: 2, c: 0 }, { r: 3, c: 0 });
    expect(frostChanges(result.steps[1]!)).toEqual([{ at: { r: 1, c: 1 }, kind: 'frost', hp: 2 }]);
  });

  it('컬러 + 컬러(보드 전체) 범위에 들고 이웃도 다 지워져도 1겹', () => {
    const board = withLayers(
      `
      C C R Y
      G . B P
      Y R G B
      P B Y R
      `,
      ['....', '.2..', '....', '....'],
    );
    const result = resolveSwap(stateOf(board), { r: 0, c: 0 }, { r: 0, c: 1 });
    expect(result.valid).toBe(true);
    expect(frostChanges(result.steps[1]!)).toEqual([{ at: { r: 1, c: 1 }, kind: 'frost', hp: 1 }]);
  });
});

describe('core: 특수 효과 범위로 얼음벽 감소', () => {
  // (2,0) Y ↔ (2,1) R- → 0열 R R R-, 가로 줄이 2행을 지운다. (2,4) 얼음은 범위 안,
  // (3,3) 얼음은 특수 효과로 지워진 (2,3)의 이웃일 뿐 범위 밖
  const board = withLayers(
    `
    R B P O G
    R Y G P B
    Y R- O B .
    P G B . O
    B P O G Y
    `,
    ['.....', '.....', '....2', '...2.', '.....'],
  );
  const result = resolveSwap(stateOf(board), { r: 2, c: 0 }, { r: 2, c: 1 });
  const first = result.steps[1]!;

  it('범위에 든 얼음벽만 1겹, 특수 효과로 지워진 블록의 이웃은 피해 없음', () => {
    expect(ofType(first, 'activate').map((e) => e.special)).toEqual(['lineH']);
    expect(frostChanges(first)).toEqual([{ at: { r: 2, c: 4 }, kind: 'frost', hp: 1 }]);
  });

  it('activate 범위에는 얼음벽 칸이 들어 있고, remove에는 없다', () => {
    const area = ofType(first, 'activate')[0]!.cleared;
    expect(area).toContainEqual({ r: 2, c: 4 });
    const removed = ofType(first, 'remove')[0]!.blocks.map((b) => b.at);
    expect(removed).not.toContainEqual({ r: 2, c: 4 });
  });
});

describe('core: 잠금 해제만 된 이웃은 얼음벽에 피해를 주지 않는다', () => {
  it('(2,1) 잠긴 R이 매치에 껴 잠금만 풀리고, 그 왼쪽 (2,0) 얼음은 그대로', () => {
    // (2,3) Y ↔ (3,3) R → 2행 (2,1)~(2,3) R R R
    const board = withLayers(
      `
      G B P O G
      B Y G P B
      . R R Y O
      P O G R Y
      B G B P O
      `,
      ['.....', '.....', '1L...', '.....', '.....'],
    );
    const result = resolveSwap(stateOf(board), { r: 2, c: 3 }, { r: 3, c: 3 });
    const first = result.steps[1]!;
    expect(ofType(first, 'obstacle')).toEqual([
      { type: 'obstacle', changes: [{ at: { r: 2, c: 1 }, kind: 'lock', hp: 0 }] },
    ]);
  });
});

describe('core: 1 → 0겹으로 깨지면 같은 resolve에서 낙하·리필로 채워진다', () => {
  // 첫 묶음과 같은 보드, 모두 1겹
  const board = withLayers(
    `
    G B P O G
    . Y . P B
    . R R Y .
    P . O R .
    B G B P O
    `,
    ['.....', '1.1..', '1...1', '.1..1', '.....'],
  );
  const result = resolveSwap(stateOf(board), { r: 2, c: 3 }, { r: 3, c: 3 });
  const [fall, refill] = [
    ofType(result.steps[2]!, 'fall')[0]!,
    ofType(result.steps[2]!, 'refill')[0]!,
  ];

  it('obstacle hp 0, 층은 null', () => {
    expect(frostChanges(result.steps[1]!).map((c) => c.hp)).toEqual([0, 0, 0, 0]);
  });

  it('깨진 칸 위의 블록이 지나 내려오고 (0,2) P → (2,2), 빈칸은 보드 위에서 리필', () => {
    const p = board.cells[0 * 5 + 2]!;
    expect(fall.moves).toContainEqual({ id: p.id, from: { r: 0, c: 2 }, to: { r: 2, c: 2 } });
    const col2 = refill.blocks.filter((b) => b.at.c === 2);
    expect(col2.map((b) => [b.at.r, b.dropFrom, b.spawnTop])).toEqual([
      [0, 2, 0],
      [1, 1, 0],
    ]);
  });

  it('남은 얼음벽 (1,0) 아래로 구간이 합쳐져 (2,0)은 그 아래에서 생긴다 (spawnTop 2)', () => {
    const col0 = refill.blocks.filter((b) => b.at.c === 0);
    expect(col0.map((b) => [b.at.r, b.spawnTop])).toEqual([[2, 2]]);
    // (3,1) 깨짐 + (2,1) 제거: 1열은 (0,1) B·(1,1) Y가 두 칸씩 내려오고 (0,1)·(1,1)을 리필
    const [b, y] = [board.cells[0 * 5 + 1]!, board.cells[1 * 5 + 1]!];
    expect(fall.moves).toContainEqual({ id: y.id, from: { r: 1, c: 1 }, to: { r: 3, c: 1 } });
    expect(fall.moves).toContainEqual({ id: b.id, from: { r: 0, c: 1 }, to: { r: 2, c: 1 } });
    const col1 = refill.blocks.filter((x) => x.at.c === 1);
    expect(col1.map((x) => [x.at.r, x.spawnTop])).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it('clearedObstacles.frost = 깨진 칸 수, 점수는 4겹분, 끝 보드는 깨진 칸이 다 채워져 있다', () => {
    const allZero = result.steps.flatMap(frostChanges).filter((c) => c.hp === 0).length;
    expect(result.clearedObstacles.frost).toBe(allZero);
    expect(allZero).toBeGreaterThanOrEqual(4);
    expect(ofType(result.steps[1]!, 'score')[0]!.delta).toBe(
      SCORE.perBlock * 3 + 4 * SCORE.obstacle,
    );
    const end = result.state.board;
    for (const i of [1 * 5 + 2, 2 * 5 + 0, 2 * 5 + 4, 3 * 5 + 1]) {
      expect(end.layers![i]).toBeNull();
      expect(end.cells[i]).not.toBeNull();
    }
  });
});

describe('core: 연쇄마다 1겹씩 (3겹)', () => {
  // (3,2) Y ↔ (3,3) R → 3행 R R R가 (4,2) 얼음(3겹) 위 (3,2)를 지운다 (3 → 2).
  // 1열이 한 칸 내려와 (2,1)~(4,1) B B B 연쇄가 (4,2)의 왼쪽 (4,1)을 지운다 (2 → 1)
  const board = withLayers(
    `
    G Y P O G
    P B O G Y
    O B G P B
    R R Y R O
    Y B . P G
    `,
    ['.....', '.....', '.....', '.....', '..3..'],
  );
  const result = resolveSwap(stateOf(board), { r: 3, c: 2 }, { r: 3, c: 3 });

  it('cascade 0에서 2겹, cascade 1에서 1겹 남는다', () => {
    expect(ofType(result.steps[3]!, 'match')[0]!.cascade).toBe(1);
    expect(frostChanges(result.steps[1]!)).toEqual([{ at: { r: 4, c: 2 }, kind: 'frost', hp: 2 }]);
    expect(frostChanges(result.steps[3]!)).toEqual([{ at: { r: 4, c: 2 }, kind: 'frost', hp: 1 }]);
  });

  it('연쇄 점수에도 배율이 붙는다', () => {
    const score = ofType(result.steps[3]!, 'score')[0]!;
    const groups = ofType(result.steps[3]!, 'match')[0]!.groups;
    const base = groups.reduce((s, g) => s + SCORE.perBlock * g.cells.length, 0);
    const hits = ofType(result.steps[3]!, 'obstacle').flatMap((e) => e.changes).length;
    expect(score.delta).toBe(Math.floor((base + hits * SCORE.obstacle) * cascadeMultiplier(1)));
  });

  it('(4,2)의 피해는 겹수가 1씩 줄어드는 순서로만 나온다', () => {
    const hps = result.steps
      .flatMap(frostChanges)
      .filter((c) => c.at.r === 4 && c.at.c === 2)
      .map((c) => c.hp);
    expect(hps.slice(0, 2)).toEqual([2, 1]);
    hps.forEach((hp, k) => expect(hp).toBe(2 - k));
    expect(frostAt(result.state.board, 4, 2)).toBe(Math.max(0, 3 - hps.length));
  });
});

describe('core: 얼음벽 스테이지 연속 플레이 (결정성·일관성)', () => {
  const stage = obstacleStage();
  const start = (seed: number) =>
    createInitialState({ rows: 8, cols: 8, colors: stage.colors, seed, layers: stage.layers });

  it.each(['keep', 'explode'] as const)(
    '%s: seed 1~20, 힌트 수 40번: step마다 칸당 1겹, 층·이벤트·집계가 맞고 3겹도 깨진다',
    (mode) => {
      let brokenFromThree = 0;
      for (let seed = 1; seed <= 20; seed++) {
        let state = start(seed);
        const hitsOf = new Map<number, number>(); // 처음 3겹 칸이 받은 피해
        for (let move = 0; move < 40; move++) {
          const before = state.board;
          const hint = findHint(before)!;
          const result = resolveSwap(state, hint.a, hint.b, mode);
          const after = result.state.board;

          const hp: number[] = before.layers!.map((l) => l?.frost ?? 0);
          let zeros = 0;
          for (const step of result.steps) {
            const changes = frostChanges(step);
            const seen = new Set<number>();
            for (const { at, hp: left } of changes) {
              const i = at.r * 8 + at.c;
              expect(seen.has(i)).toBe(false);
              seen.add(i);
              expect(left).toBe(hp[i]! - 1);
              hp[i] = left;
              if (left === 0) zeros++;
              if (stage.layers![i]?.frost === 3) hitsOf.set(i, (hitsOf.get(i) ?? 0) + 1);
            }
          }
          expect(result.clearedObstacles.frost).toBe(zeros);
          after.layers!.forEach((l, i) => {
            expect(l?.frost ?? 0).toBe(hp[i]);
            if (hp[i]! > 0) expect(after.cells[i]).toBeNull();
          });
          state = result.state;
        }
        if ([...hitsOf.values()].some((n) => n >= 3)) brokenFromThree++;
      }
      expect(brokenFromThree).toBeGreaterThan(0);
    },
  );

  it('같은 seed + 같은 입력 → 같은 결과 (clearedObstacles 포함), 얼음벽이 깨진다', () => {
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
    const broken = play(9).reduce((sum, r) => sum + r.clearedObstacles.frost, 0);
    expect(broken).toBeGreaterThan(0);
  });
});
