// V2-W2-01: 장애물 층이 있는 보드의 시작 보드·스왑 가능 여부·셔플·낙하·불변식 (PLAN2 5.1·5.2)
import { describe, expect, it } from 'vitest';
import { createBoard, isFrost, isLocked } from '../../src/core/board';
import { assertInvariants, createInitialState, resolveSwap } from '../../src/core/engine';
import { applyGravity, refill } from '../../src/core/gravity';
import { findMatches } from '../../src/core/matcher';
import { findHint, hasAnyMove, isValidSwap, shuffle } from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import type { Board, CellLayer } from '../../src/core/types';
import { obstacleStage } from '../../src/dev/obstacleStage';
import { parseBoard } from '../helpers/board';

const stage = obstacleStage();
const layers = stage.layers!;
const start = (seed: number) =>
  createInitialState({ rows: 8, cols: 8, colors: stage.colors, seed, layers });

const frostIdx = layers.flatMap((l, i) => ((l?.frost ?? 0) > 0 ? [i] : []));
const lockIdx = layers.flatMap((l, i) => (l?.lock ? [i] : []));

/** 문자 그리드 → 층 배열 (F = 얼음 1겹, L = 잠금) */
function layersFrom(rows: string[]): (CellLayer | null)[] {
  return rows.flatMap((row) =>
    [...row].map((ch) => (ch === 'F' ? { frost: 1 } : ch === 'L' ? { lock: true } : null)),
  );
}

describe('core: 장애물 시작 보드 (PLAN2 5.2)', () => {
  it('같은 seed → 같은 시작 보드·장애물 층', () => {
    expect(start(77)).toEqual(start(77));
    expect(start(77).board.cells).not.toEqual(start(78).board.cells);
    expect(start(77).board.layers).toBe(layers);
  });

  it('얼음벽 칸은 블록 없음(null), 잠긴 칸은 블록 있음', () => {
    const { board } = start(1);
    frostIdx.forEach((i) => expect(board.cells[i]).toBeNull());
    lockIdx.forEach((i) => expect(board.cells[i]).not.toBeNull());
    expect(board.cells.filter((b) => b === null)).toHaveLength(frostIdx.length);
    // id는 1부터 빈틈없이, nextId는 블록 수 + 1
    const ids = board.cells.flatMap((b) => (b ? [b.id] : []));
    expect(ids).toEqual(Array.from({ length: ids.length }, (_, k) => k + 1));
    expect(board.nextId).toBe(ids.length + 1);
  });

  it('seed 1~300: 시작 매치 0, 가능한 수 ≥ 1 (힌트는 잠긴 블록·얼음벽을 쓰지 않는다)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { board } = start(seed);
      expect(findMatches(board)).toEqual([]);
      const hint = findHint(board);
      expect(hint, `seed ${seed}`).not.toBeNull();
      for (const p of [hint!.a, hint!.b]) {
        expect(isLocked(board, p) || isFrost(board, p)).toBe(false);
      }
      assertInvariants(board);
    }
  });

  it('layers 없는 createBoard는 v0.1과 같다 (layers 키 없음, RNG 소비 같음)', () => {
    const [plain, rngA] = createBoard(8, 8, 5, createRng(1001));
    const [empty, rngB] = createBoard(8, 8, 5, createRng(1001), Array(64).fill(null));
    expect(plain).not.toHaveProperty('layers');
    expect(empty.cells).toEqual(plain.cells);
    expect(rngB).toBe(rngA);
  });

  it('layers 길이가 칸 수와 다르면 RangeError', () => {
    expect(() => createBoard(8, 8, 5, createRng(1), Array(63).fill(null))).toThrow(RangeError);
  });

  it('얼음벽이 너무 많아 수가 없으면 생성 실패', () => {
    const allFrost = Array(64).fill({ frost: 1 });
    expect(() =>
      createInitialState({ rows: 8, cols: 8, colors: 5, seed: 1, layers: allFrost }),
    ).toThrow();
  });
});

describe('core: 스왑 대상에서 잠금·얼음벽 제외 (PLAN2 5.2)', () => {
  // 가운데 열 R을 끌어오면 매치가 되는 모양. 잠기거나 얼음벽이면 스왑 불가
  const base = parseBoard(`
    R Y R
    B R B
    Y G Y
  `);
  const withLayers = (rows: string[]): Board => ({ ...base, layers: layersFrom(rows) });

  it('층 없으면 (0,1)↔(1,1) 유효', () => {
    expect(isValidSwap(base, { r: 0, c: 1 }, { r: 1, c: 1 })).toBe(true);
  });

  it('어느 한쪽이 잠겼으면 무효, hasAnyMove도 그 수를 세지 않는다', () => {
    const locked = withLayers(['...', '.L.', '...']);
    expect(isValidSwap(locked, { r: 0, c: 1 }, { r: 1, c: 1 })).toBe(false);
    expect(isValidSwap(locked, { r: 1, c: 1 }, { r: 0, c: 1 })).toBe(false);
    expect(hasAnyMove(locked)).toBe(false);
  });

  it('잠긴 블록도 매치에는 낀다 (다른 두 블록 스왑으로 잠긴 R과 매치)', () => {
    const lockedCorner = withLayers(['L..', '...', '...']);
    expect(isValidSwap(lockedCorner, { r: 0, c: 1 }, { r: 1, c: 1 })).toBe(true);
  });

  it('얼음벽(빈칸) 칸과는 스왑할 수 없다', () => {
    const board: Board = {
      ...parseBoard(`
        R Y R
        B . B
        Y R Y
      `),
      layers: layersFrom(['...', '.F.', '...']),
    };
    expect(isValidSwap(board, { r: 0, c: 1 }, { r: 1, c: 1 })).toBe(false);
    expect(findHint(board)).toBeNull();
  });
});

describe('core: 장애물 보드 셔플 (PLAN2 5.2)', () => {
  it('잠긴 블록과 얼음벽 칸은 그대로, 움직일 수 있는 블록만 섞는다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { board } = start(seed);
      const result = shuffle(board, stage.colors, createRng(seed * 7));
      const after = result.board;
      expect(after.layers).toBe(layers);
      frostIdx.forEach((i) => expect(after.cells[i]).toBeNull());
      const regenerated = after.nextId !== board.nextId;
      if (!regenerated) {
        lockIdx.forEach((i) => expect(after.cells[i]).toBe(board.cells[i]));
        const ids = (b: Board) => b.cells.flatMap((x) => (x ? [x.id] : [])).sort((a, c) => a - c);
        expect(ids(after)).toEqual(ids(board));
      }
      expect(findMatches(after)).toEqual([]);
      expect(hasAnyMove(after)).toBe(true);
      // 셔플 이벤트에는 얼음벽 칸이 없다
      for (const { to } of result.event.mapping) {
        expect(frostIdx).not.toContain(to.r * 8 + to.c);
      }
    }
  });
});

describe('core: 얼음벽 칸 낙하·리필 최소 처리', () => {
  // 열 0: 위에서부터 [블록, 빈칸, 얼음벽, 빈칸, 블록]
  const board: Board = {
    ...parseBoard(`
      R Y
      . G
      . B
      . P
      Y O
    `),
    layers: layersFrom(['..', '..', 'F.', '..', '..']),
  };

  it('블록은 얼음벽을 통과하지 못하고 그 위에서 멈춘다', () => {
    const { board: fallen } = applyGravity(board);
    expect(fallen.cells[0]).toBeNull();
    expect(fallen.cells[2]!.color).toBe(0); // R이 (1,0)으로
    expect(fallen.cells[4]).toBeNull(); // 얼음벽 칸은 그대로
    expect(fallen.cells[6]).toBeNull();
    expect(fallen.cells[8]!.color).toBe(1); // 맨 아래 Y는 그대로
  });

  it('리필은 얼음벽 칸을 채우지 않고 구간마다 dropFrom을 센다', () => {
    const { board: fallen } = applyGravity(board);
    const { board: filled, event } = refill(fallen, 5, createRng(3));
    expect(filled.cells[4]).toBeNull();
    expect(event.blocks.map((b) => [b.at, b.dropFrom])).toEqual([
      [{ r: 0, c: 0 }, 1],
      [{ r: 3, c: 0 }, 1],
    ]);
    expect(filled.cells.flatMap((b, i) => (b ? [] : [i]))).toEqual([4]); // 빈칸은 얼음벽 칸뿐
  });
});

describe('core: assertInvariants (PLAN2 5.1)', () => {
  it('얼음벽 칸 밖의 빈칸, 얼음벽 칸의 블록은 오류', () => {
    const { board } = start(5);
    const cells = board.cells.slice();
    const free = cells.findIndex((b, i) => b && !frostIdx.includes(i));
    cells[free] = null;
    expect(() => assertInvariants({ ...board, cells })).toThrow('빈칸');
    const filled = board.cells.slice();
    filled[frostIdx[0]!] = { id: 999, color: 0 };
    expect(() => assertInvariants({ ...board, cells: filled })).toThrow('얼음벽');
  });
});

describe('core: 장애물 보드에서 일반 플레이', () => {
  it('seed 1~20, 힌트 수 40번: 오류 없이 resolve되고 얼음벽 칸은 계속 비어 있다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let state = start(seed);
      for (let move = 0; move < 40; move++) {
        const hint = findHint(state.board)!;
        const result = resolveSwap(state, hint.a, hint.b);
        expect(result.valid).toBe(true);
        state = result.state;
        frostIdx.forEach((i) => expect(state.board.cells[i]).toBeNull());
      }
      // 잠금만 풀릴 수 있다. 얼음벽·젤리는 V2-W2-03·04 전까지 그대로
      state.board.layers!.forEach((layer, i) => {
        expect(layer?.frost).toBe(layers[i]?.frost);
        expect(layer?.jelly).toBe(layers[i]?.jelly);
        if (layer?.lock) expect(layers[i]?.lock).toBe(true);
      });
    }
  });

  it('같은 seed + 같은 입력 → 같은 결과', () => {
    const play = () => {
      let state = start(9);
      for (let move = 0; move < 30; move++) {
        const hint = findHint(state.board)!;
        state = resolveSwap(state, hint.a, hint.b).state;
      }
      return state;
    };
    expect(play()).toEqual(play());
  });
});

describe('core: 셔플 상한 재생성도 잠긴 칸을 지킨다 (V2-W2-01 리뷰 1)', () => {
  // (2,1)·(2,2)만 움직일 수 있고 둘 다 B라 어떻게 섞어도 수가 없다 → 재생성으로 간다.
  // (2,2)=G, (2,1)≠G가 되면 스왑으로 열 1에 G 세 개가 생긴다
  const board: Board = {
    ...parseBoard(`
      R Y G B P
      Y G R P B
      G B B R Y
      B G G Y P
      P Y R G B
    `),
    layers: Array.from({ length: 25 }, (_, i) => (i === 11 || i === 12 ? null : { lock: true })),
  };

  it('잠긴 칸 블록(id·색·특수)은 그대로, 새 블록은 nextId부터, 결과는 플레이 가능', () => {
    expect(hasAnyMove(board)).toBe(false);
    const { board: after, event } = shuffle(board, 5, createRng(1));
    board.cells.forEach((b, i) => {
      if (i !== 11 && i !== 12) expect(after.cells[i]).toBe(b);
    });
    expect([after.cells[11]!.id, after.cells[12]!.id]).toEqual([board.nextId, board.nextId + 1]);
    expect(after.nextId).toBe(board.nextId + 2);
    expect(findMatches(after)).toEqual([]);
    expect(hasAnyMove(after)).toBe(true);
    expect(event.mapping).toHaveLength(25);
  });

  it('같은 입력 → 같은 결과', () => {
    expect(shuffle(board, 5, createRng(4))).toEqual(shuffle(board, 5, createRng(4)));
  });
});

describe('core: resolveSwap은 잠긴 칸·얼음벽 칸을 거부한다 (V2-W2-01 리뷰 2)', () => {
  const base = parseBoard(`
    R Y R
    B R B
    Y G Y
  `);
  const state = (board: Board) => ({ board, rngState: 1, colors: 5 });

  it('잠긴 칸이 끼면 이벤트 없이 무효, 상태 그대로 (isValidSwap과 같다)', () => {
    const locked: Board = { ...base, layers: layersFrom(['...', '.L.', '...']) };
    for (const [a, b] of [
      [
        { r: 0, c: 1 },
        { r: 1, c: 1 },
      ],
      [
        { r: 1, c: 1 },
        { r: 0, c: 1 },
      ],
    ]) {
      expect(isValidSwap(locked, a!, b!)).toBe(false);
      const result = resolveSwap(state(locked), a!, b!);
      expect(result.valid).toBe(false);
      expect(result.steps).toEqual([]);
      expect(result.state.board).toBe(locked);
    }
  });

  it('잠금이 없으면 같은 스왑이 유효', () => {
    expect(resolveSwap(state(base), { r: 0, c: 1 }, { r: 1, c: 1 }).valid).toBe(true);
  });

  it('얼음벽 칸과의 스왑도 이벤트 없이 무효', () => {
    const board: Board = {
      ...parseBoard(`
        R Y R
        B . B
        Y R Y
      `),
      layers: layersFrom(['...', '.F.', '...']),
    };
    const result = resolveSwap(state(board), { r: 0, c: 1 }, { r: 1, c: 1 });
    expect(result.valid).toBe(false);
    expect(result.steps).toEqual([]);
  });
});
