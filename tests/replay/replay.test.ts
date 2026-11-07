// 경쟁 모드 리플레이 (SPEC 5.3, PLAN2 5.8·6.4. V2-W2-08 PoC에서 옮김) — 같은 seed·로그면 같은 점수, 무효 스왑은 점수·상태 그대로,
// GameScene처럼 스왑들 → 마지막 팡 순서로 합산. 시각·간격 판정은 judge.test.ts.
// 실제 브라우저 기록(fixtures/browser-runs.json)은 리플레이 점수 == 결과 화면 점수 (화면 경로 일치)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_GAP_MS, randomLog, SHUFFLE_SEEDS } from '../../scripts/server-poc/logs';
import { replayTimeAttack, TIMEATTACK_BOARD, type ReplayMove } from '../../src/replay/replay';
import { createInitialState, resolveFinale, resolveSwap } from '../../src/core/engine';
import type { GameState, Pos } from '../../src/core/types';

interface BrowserRun {
  seed: number;
  kind: 'demo' | 'hand' | 'rngValid';
  screenScore: number;
  inFlightAtTimeUp: number[];
  moves: ReplayMove[];
}
const browserRuns = (
  JSON.parse(
    readFileSync(join(__dirname, '../../scripts/server-poc/fixtures/browser-runs.json'), 'utf8'),
  ) as { runs: BrowserRun[] }
).runs;

/** 로그를 core로 그대로 돌려 셔플 수와 각 스왑의 유효 여부를 센다 (시간은 보지 않음) */
function trace(seed: number, moves: readonly ReplayMove[]) {
  let state = initial(seed);
  let shuffleAt = -1;
  const valid = moves.map((m, i) => {
    const result = resolveSwap(state, m.from, m.to);
    state = result.state;
    if (shuffleAt < 0 && result.steps.flat().some((e) => e.type === 'shuffle')) shuffleAt = i;
    return result.valid;
  });
  return { shuffleAt, valid };
}

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

describe('replay/replayTimeAttack', () => {
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
    }
    expect(checkedFinale).toBeGreaterThan(0); // 마지막 팡이 실제로 점수를 낸 판이 있어야 의미가 있다
  });

  describe('실제 브라우저 기록 (fixtures/browser-runs.json)', () => {
    it.each(browserRuns.map((run) => [`${run.kind} seed ${run.seed}`, run] as const))(
      '%s: 리플레이 점수 == 결과 화면 점수',
      (_, run) => {
        const result = replayTimeAttack(run.seed, run.moves);
        expect(result.score).toBe(run.screenScore);
      },
    );

    it('5판 이상이고 셔플·무효 스왑·재생 중 타임 업 판이 들어 있다', () => {
      expect(new Set(browserRuns.map((r) => r.seed)).size).toBeGreaterThanOrEqual(5);
      const traces = browserRuns.map((r) => trace(r.seed, r.moves));
      expect(traces.filter((t) => t.shuffleAt >= 0).length).toBeGreaterThan(0);
      // rngValid 판은 core 탐색과 같은 순번에서 셔플이 났다 (화면에서도 같은 수열을 뒀다)
      browserRuns.forEach((run, i) => {
        if (run.kind === 'rngValid') {
          expect(traces[i]!.shuffleAt).toBe(SHUFFLE_SEEDS[run.seed as keyof typeof SHUFFLE_SEEDS]);
        }
      });
      const hand = browserRuns.filter((r) => r.kind === 'hand');
      expect(hand.length).toBeGreaterThan(0);
      for (const run of hand) expect(trace(run.seed, run.moves).valid).toContain(false);
      // 타임 업 때 재생 중이던 스왑: 마지막 스왑이고 t < 제한 시간
      for (const run of browserRuns) {
        expect(run.inFlightAtTimeUp).toEqual([run.moves.length - 1]);
        expect(run.moves.at(-1)!.t).toBeLessThan(TIMEATTACK_BOARD.timeLimitMs);
      }
    });
  });

  describe('현실 로그 옵션 (logs.ts)', () => {
    it('realistic: 유효 스왑 뒤 433ms, 무효 뒤 240ms 이상 띄운다', () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const log = randomLog(seed, seed, { realistic: true });
        const { valid } = trace(seed, log);
        expect(valid).toContain(false);
        for (let i = 0; i + 1 < log.length; i++) {
          const gap = log[i + 1]!.t - log[i]!.t;
          expect(gap).toBeGreaterThanOrEqual(valid[i] ? MIN_GAP_MS.valid : MIN_GAP_MS.invalid);
        }
      }
    });

    it('boundary: 마지막 move를 59999에 두고, late: 60000부터 move를 덧붙인다 (판정은 judge.test.ts)', () => {
      const limit = TIMEATTACK_BOARD.timeLimitMs;
      // 간격 하한 때문에 59999에 못 두는 판도 있어 몇 개 중 하나라도
      const withBoundary = [5, 15, 25, 35]
        .map((seed) => randomLog(seed, seed, { realistic: true, boundary: true }))
        .filter((log) => log.at(-1)!.t === limit - 1);
      expect(withBoundary.length).toBeGreaterThan(0);

      const late = randomLog(10, 10, { realistic: true, late: 3 });
      const lateMoves = late.filter((m) => m.t >= limit);
      expect(lateMoves).toHaveLength(3);
      expect(late.slice(-3)).toEqual(lateMoves); // 늦은 move는 끝에만 붙는다
    });

    it('rngValid: SHUFFLE_SEEDS 보드는 적힌 순번에서 셔플이 일어난다', () => {
      for (const [seed, at] of Object.entries(SHUFFLE_SEEDS)) {
        const log = randomLog(Number(seed), 1, { realistic: true, pick: 'rngValid' });
        const { shuffleAt, valid } = trace(Number(seed), log);
        expect(shuffleAt).toBe(at);
        expect(valid.every(Boolean)).toBe(true);
      }
    });
  });
});
