// V2-W2-08: 경쟁 모드 리플레이 PoC (SPEC 5.3) — 같은 seed·로그면 같은 점수, 무효 스왑은 점수·상태 그대로,
// GameScene처럼 스왑들 → 마지막 팡 순서로 합산, 시간이 끝난 뒤의 move는 받지 않는다
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { randomLog } from '../../scripts/server-poc/logs';
import {
  replayTimeAttack,
  TIMEATTACK_BOARD,
  type ReplayMove,
} from '../../scripts/server-poc/replay';
import { createInitialState, resolveFinale, resolveSwap } from '../../src/core/engine';
import type { GameState, Pos } from '../../src/core/types';

const initial = (seed: number) => {
  const { rows, cols, colors } = TIMEATTACK_BOARD;
  return createInitialState({ rows, cols, colors, seed });
};

/** 인접하고 매치가 없어 무효인 스왑 하나 */
function invalidSwapOn(state: GameState): { from: Pos; to: Pos } {
  const { rows, cols } = state.board;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const from = { r, c };
      const to = { r, c: c + 1 };
      if (!resolveSwap(state, from, to).valid) return { from, to };
    }
  }
  throw new Error('무효 스왑이 없다');
}

describe('server-poc/replay (V2-W2-08)', () => {
  it('TIMEATTACK_BOARD는 public/stages/timeattack.json과 같다', () => {
    const json = JSON.parse(
      readFileSync(join(__dirname, '../../public/stages/timeattack.json'), 'utf8'),
    ) as { rows: number; cols: number; colors: number; timeLimit: number };
    expect(TIMEATTACK_BOARD).toEqual({
      rows: json.rows,
      cols: json.cols,
      colors: json.colors,
      timeLimitMs: json.timeLimit * 1000,
    });
  });

  it('같은 seed의 로그는 항상 같고, 같은 로그의 리플레이 점수도 항상 같다', () => {
    for (const seed of [1, 2, 397, 1000]) {
      const log = randomLog(seed);
      expect(randomLog(seed)).toEqual(log);
      expect(log.length).toBeGreaterThanOrEqual(20);
      expect(log.every((m, i) => i === 0 || m.t >= log[i - 1]!.t)).toBe(true);
      expect(log.at(-1)!.t).toBeLessThan(TIMEATTACK_BOARD.timeLimitMs);
      expect(replayTimeAttack(seed, log)).toEqual(replayTimeAttack(seed, log));
    }
    expect(randomLog(1)).not.toEqual(randomLog(2));
  });

  it('무효 스왑은 점수·상태를 바꾸지 않는다 (끼워 넣어도 무효 수만 1 늘어난다)', () => {
    const seed = 7;
    const log = randomLog(seed).slice(0, 10);
    // 5수 뒤의 보드에서 무효인 스왑을 찾아 그 자리에 끼운다
    let state = initial(seed);
    for (const m of log.slice(0, 5)) state = resolveSwap(state, m.from, m.to).state;
    const bad = invalidSwapOn(state);
    const invalid = resolveSwap(state, bad.from, bad.to);
    expect(invalid.state).toBe(state);
    expect(invalid.scoreDelta).toBe(0);

    const withBad: ReplayMove[] = [...log.slice(0, 5), { ...bad, t: log[4]!.t }, ...log.slice(5)];
    const base = replayTimeAttack(seed, log);
    const got = replayTimeAttack(seed, withBad);
    expect(got).toEqual({ ...base, invalidMoves: base.invalidMoves + 1 });
    // 보드 밖·인접하지 않은 입력도 같다
    const offBoard: ReplayMove = { from: { r: 0, c: 0 }, to: { r: 0, c: 2 }, t: 0 };
    expect(replayTimeAttack(seed, [offBoard, ...log])).toEqual({
      ...base,
      invalidMoves: base.invalidMoves + 1,
    });
  });

  it('GameScene과 같은 순서로 합산한다: 스왑들의 scoreDelta → 마지막 팡 한 번', () => {
    let checkedFinale = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const log = randomLog(seed);
      let state = initial(seed);
      let swaps = 0;
      for (const m of log) {
        const result = resolveSwap(state, m.from, m.to);
        state = result.state;
        swaps += result.scoreDelta;
      }
      const finale = resolveFinale(state);
      const finaleScore = finale.valid ? finale.scoreDelta : 0;
      if (finaleScore > 0) checkedFinale++;

      const got = replayTimeAttack(seed, log);
      expect(got.finaleScore).toBe(finaleScore);
      expect(got.score).toBe(swaps + finaleScore);
      expect(got.validMoves + got.invalidMoves).toBe(log.length);
      expect(got.lateMoves).toBe(0);
    }
    expect(checkedFinale).toBeGreaterThan(0); // 마지막 팡이 실제로 점수를 낸 판이 있어야 의미가 있다
  });

  it('시간이 끝난 뒤(t ≥ 제한 시간)의 move는 받지 않는다. 직전 move는 끝까지 더한다', () => {
    const seed = 3;
    const log = randomLog(seed);
    const base = replayTimeAttack(seed, log);
    const last = log.at(-1)!;
    // 제한 시간 0.001초 전에 시작한 스왑은 받는다 (게임도 재생 중에 시간이 끝나면 점수를 그대로 더한다)
    const justBefore = replayTimeAttack(seed, [
      ...log.slice(0, -1),
      { ...last, t: TIMEATTACK_BOARD.timeLimitMs - 1 },
    ]);
    expect(justBefore).toEqual(base);
    const late = replayTimeAttack(seed, [
      ...log.slice(0, -1),
      { ...last, t: TIMEATTACK_BOARD.timeLimitMs },
    ]);
    expect(late).toEqual({ ...replayTimeAttack(seed, log.slice(0, -1)), lateMoves: 1 });
  });
});
