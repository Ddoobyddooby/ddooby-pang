// 퍼즈 테스트: 랜덤 seed + 랜덤 유효 스왑을 반복해 resolve가 깨지지 않는지 본다 (PLAN 8, 10절)
import { describe, expect, it } from 'vitest';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findMatches } from '../../src/core/matcher';
import { hasAnyMove, isValidSwap } from '../../src/core/moves';
import { createRng, nextInt, type RngState } from '../../src/core/rng';
import type { Board, GameEvent, GameState, Pos } from '../../src/core/types';
import { EventTracker } from '../../src/view/eventTracker';
import { printBoard } from '../helpers/board';

function validSwaps(board: Board): { a: Pos; b: Pos }[] {
  const out: { a: Pos; b: Pos }[] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const a = { r, c };
      if (c + 1 < board.cols && isValidSwap(board, a, { r, c: c + 1 }))
        out.push({ a, b: { r, c: c + 1 } });
      if (r + 1 < board.rows && isValidSwap(board, a, { r: r + 1, c }))
        out.push({ a, b: { r: r + 1, c } });
    }
  }
  return out;
}

const key = (p: Pos) => `${p.r},${p.c}`;

/**
 * view가 하는 일을 흉내 낸다: 이전 보드에서 시작해 이벤트만 적용해서 id → 위치를 추적한다.
 * 결과가 core의 최종 보드와 같아야 view가 이벤트만 보고 화면을 정확히 그릴 수 있다.
 */
function replay(before: Board, steps: readonly (readonly GameEvent[])[]): Map<string, number> {
  const at = new Map<string, number>(); // "r,c" → id
  before.cells.forEach(
    (b, i) => b && at.set(key({ r: Math.floor(i / before.cols), c: i % before.cols }), b.id),
  );

  for (const step of steps) {
    for (const e of step) {
      switch (e.type) {
        case 'swap':
        case 'swapBack': {
          const ia = at.get(key(e.a))!;
          const ib = at.get(key(e.b))!;
          at.set(key(e.a), ib);
          at.set(key(e.b), ia);
          break;
        }
        case 'remove':
          for (const b of e.blocks) {
            if (at.get(key(b.at)) !== b.id)
              throw new Error(`remove: ${key(b.at)}에 ${b.id}가 없다`);
            at.delete(key(b.at));
          }
          break;
        case 'fall': {
          // 같은 열에서 동시에 움직이므로 먼저 전부 떼고 나중에 놓는다
          for (const m of e.moves) {
            if (at.get(key(m.from)) !== m.id)
              throw new Error(`fall: ${key(m.from)}에 ${m.id}가 없다`);
            at.delete(key(m.from));
          }
          for (const m of e.moves) {
            if (at.has(key(m.to))) throw new Error(`fall: ${key(m.to)}가 비어 있지 않다`);
            at.set(key(m.to), m.id);
          }
          break;
        }
        case 'refill':
          for (const b of e.blocks) {
            if (at.has(key(b.at))) throw new Error(`refill: ${key(b.at)}가 비어 있지 않다`);
            at.set(key(b.at), b.block.id);
          }
          break;
        case 'shuffle':
          at.clear();
          for (const m of e.mapping) at.set(key(m.to), m.block.id);
          break;
        case 'create':
          if (at.has(key(e.at))) throw new Error(`create: ${key(e.at)}가 비어 있지 않다`);
          at.set(key(e.at), e.block.id);
          break;
        case 'match':
        case 'activate':
        case 'score':
          break;
      }
    }
  }
  return at;
}

function boardIds(board: Board): Map<string, number> {
  const m = new Map<string, number>();
  board.cells.forEach(
    (b, i) => b && m.set(key({ r: Math.floor(i / board.cols), c: i % board.cols }), b.id),
  );
  return m;
}

interface FuzzConfig {
  rows: number;
  cols: number;
  colors: number;
  games: number;
  swapsPerGame: number;
  newSpecialInBlast?: 'keep' | 'explode';
}

function fuzz({ rows, cols, colors, games, swapsPerGame, newSpecialInBlast }: FuzzConfig) {
  let picker: RngState = createRng(rows * 1000 + colors); // 스왑 선택용 (게임 rng와 별개)
  const stats = { swaps: 0, cascades: 0, maxCascade: 0, shuffles: 0, creates: 0, activates: 0 };

  for (let game = 1; game <= games; game++) {
    const seed = game * 7919 + colors;
    let state: GameState = createInitialState({ rows, cols, colors, seed });

    for (let turn = 0; turn < swapsPerGame; turn++) {
      const where = `seed ${seed}, turn ${turn}\n${printBoard(state.board)}`;
      const options = validSwaps(state.board);
      expect(options.length, where).toBeGreaterThan(0);

      let pick: number;
      [pick, picker] = nextInt(picker, options.length);
      const { a, b } = options[pick]!;

      let result: ReturnType<typeof resolveSwap>;
      try {
        result = resolveSwap(state, a, b, newSpecialInBlast);
      } catch (e) {
        throw new Error(`${(e as Error).message}\n${where}\nswap ${key(a)} ↔ ${key(b)}`, {
          cause: e,
        });
      }
      expect(result.valid, where).toBe(true);

      const board = result.state.board;
      expect(
        board.cells.every((x) => x !== null),
        where,
      ).toBe(true);
      expect(findMatches(board), where).toEqual([]);
      expect(hasAnyMove(board), where).toBe(true);
      expect(replay(state.board, result.steps), where).toEqual(boardIds(board));
      // view가 실제로 쓰는 EventTracker도 같은 결과를 내야 한다
      const tracker = new EventTracker(state.board);
      for (const e of result.steps.flat()) tracker.apply(e);
      expect(tracker.snapshot(), where).toEqual(boardIds(board));

      // 점수: match가 있는 step마다 score 정확히 1개, 같은 cascade, delta > 0, 합 = scoreDelta
      let scoreSum = 0;
      for (const step of result.steps) {
        const match = step.find((e) => e.type === 'match');
        const scores = step.filter((e) => e.type === 'score');
        expect(scores, where).toHaveLength(match ? 1 : 0);
        const score = scores[0];
        if (match?.type === 'match' && score?.type === 'score') {
          expect(score.cascade, where).toBe(match.cascade);
          expect(score.delta, where).toBeGreaterThan(0);
          scoreSum += score.delta;
        }
      }
      expect(result.scoreDelta, where).toBe(scoreSum);

      const ids = board.cells.map((x) => x!.id);
      expect(new Set(ids).size, where).toBe(ids.length);

      const cascades = result.steps.flat().filter((e) => e.type === 'match').length;
      stats.swaps++;
      stats.cascades += cascades;
      stats.maxCascade = Math.max(stats.maxCascade, cascades);
      if (result.steps.flat().some((e) => e.type === 'shuffle')) stats.shuffles++;
      stats.creates += result.steps.flat().filter((e) => e.type === 'create').length;
      stats.activates += result.steps.flat().filter((e) => e.type === 'activate').length;

      state = result.state;
    }
  }
  return stats;
}

describe('fuzz: 랜덤 유효 스왑', () => {
  it.each([3, 4, 5, 6])('8x8, colors=%i: 20판 × 50수 = 1000회', (colors) => {
    const stats = fuzz({ rows: 8, cols: 8, colors, games: 20, swapsPerGame: 50 });
    expect(stats.swaps).toBe(1000);
    expect(stats.cascades).toBeGreaterThanOrEqual(1000);
    if (colors <= 4) expect(stats.maxCascade).toBeGreaterThan(1); // 색이 적으면 연쇄가 실제로 일어난다
    // 특수 블록이 실제로 생기고 발동한다
    expect(stats.creates).toBeGreaterThan(0);
    expect(stats.activates).toBeGreaterThan(0);
  });

  it("8x8, colors=4, newSpecialInBlast 'explode': 1000회", () => {
    const stats = fuzz({
      rows: 8,
      cols: 8,
      colors: 4,
      games: 20,
      swapsPerGame: 50,
      newSpecialInBlast: 'explode',
    });
    expect(stats.swaps).toBe(1000);
    expect(stats.activates).toBeGreaterThan(0);
  });

  it('5x5, colors=5: 셔플이 자주 일어나는 작은 보드 1000회', () => {
    const stats = fuzz({ rows: 5, cols: 5, colors: 5, games: 20, swapsPerGame: 50 });
    expect(stats.swaps).toBe(1000);
    expect(stats.shuffles).toBeGreaterThan(0);
  });
});
