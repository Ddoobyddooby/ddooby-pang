// V2-W2-08: 1000개 랜덤 로그와 Node 리플레이 점수를 out/node-scores.json에 쓴다 (런타임 이식성 비교용).
// deno/compare.ts가 같은 로그를 Deno에서 다시 돌려 점수를 대조한다.
// 로그는 현실 간격(유효 뒤 ≥433ms, 무효 뒤 ≥240ms)이고, 일부러 넣는 경우:
// - 10번째마다 늦은 move 1~3개(t ≥ 60000) / 10번째 + 5마다 t = 59999 경계 move (간격 하한을 지킬 수 있는 판만)
// - 마지막 2판은 셔플이 일어나는 보드(SHUFFLE_SEEDS)를 rngValid 수열로 둔다

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { MIN_GAP_MS, randomLog, SHUFFLE_SEEDS, type LogOptions } from './logs';
import { replayTimeAttack, TIMEATTACK_BOARD, type ReplayMove } from './replay';

const COUNT = 1000;
const OUT = join(__dirname, 'out');
const SHUFFLE_BOARDS = Object.keys(SHUFFLE_SEEDS).map(Number);

function logFor(i: number): { seed: number; moves: ReplayMove[] } {
  const shuffleAt = i - (COUNT - SHUFFLE_BOARDS.length) - 1;
  const seed = shuffleAt >= 0 ? SHUFFLE_BOARDS[shuffleAt]! : i;
  const options: LogOptions = {
    realistic: true,
    late: i % 10 === 0 ? 1 + ((i / 10) % 3) : 0,
    boundary: i % 10 === 5,
    pick: shuffleAt >= 0 ? 'rngValid' : 'mixed',
  };
  return { seed, moves: randomLog(seed, i, options) };
}

/** 셔플 수와 move 사이 최소 간격 (유효·무효 뒤 따로). 늦은 move는 게임이 받지 않으므로 뺀다 */
function inspect(seed: number, moves: readonly ReplayMove[]) {
  const { rows, cols, colors, timeLimitMs } = TIMEATTACK_BOARD;
  let state = createInitialState({ rows, cols, colors, seed });
  let shuffles = 0;
  const gaps = { valid: Infinity, invalid: Infinity };
  moves.forEach((m, i) => {
    if (m.t >= timeLimitMs) return;
    const result = resolveSwap(state, m.from, m.to);
    state = result.state;
    shuffles += result.steps.flat().filter((e) => e.type === 'shuffle').length;
    const nextMove = moves[i + 1];
    if (nextMove) {
      const key = result.valid ? 'valid' : 'invalid';
      gaps[key] = Math.min(gaps[key], nextMove.t - m.t);
    }
  });
  return { shuffles, gaps };
}

test(`${COUNT}개 로그·점수 기록`, () => {
  const runs = Array.from({ length: COUNT }, (_, k) => {
    const { seed, moves } = logFor(k + 1);
    return { seed, moves, result: replayTimeAttack(seed, moves) };
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, 'node-scores.json'),
    JSON.stringify({ runtime: `node ${process.version}`, runs }),
  );

  const checks = runs.map((r) => inspect(r.seed, r.moves));
  const minGap = (key: 'valid' | 'invalid') => Math.min(...checks.map((c) => c.gaps[key]));
  const stats = {
    shuffleRuns: checks.filter((c) => c.shuffles > 0).length,
    lateRuns: runs.filter((r) => r.result.lateMoves > 0).length,
    lateMoves: runs.reduce((n, r) => n + r.result.lateMoves, 0),
    boundaryRuns: runs.filter((r) => r.moves.some((m) => m.t === TIMEATTACK_BOARD.timeLimitMs - 1))
      .length,
    minGapAfterValid: minGap('valid'),
    minGapAfterInvalid: minGap('invalid'),
  };
  const scores = runs.map((r) => r.result.score).sort((a, b) => a - b);
  const moveCounts = runs.map((r) => r.moves.length);
  console.log(
    `[poc] ${COUNT}개 기록: 점수 ${scores[0]}~${scores[COUNT - 1]} (중앙 ${scores[COUNT >> 1]}),` +
      ` 수 ${Math.min(...moveCounts)}~${Math.max(...moveCounts)},` +
      ` 무효 ${runs.reduce((n, r) => n + r.result.invalidMoves, 0)}개,` +
      ` 마지막 팡 있음 ${runs.filter((r) => r.result.finaleScore > 0).length}판\n` +
      `[poc] 셔플 ${stats.shuffleRuns}판, 늦은 move ${stats.lateRuns}판(${stats.lateMoves}개),` +
      ` t=59999 경계 ${stats.boundaryRuns}판, 최소 간격 유효 뒤 ${stats.minGapAfterValid}ms·무효 뒤 ${stats.minGapAfterInvalid}ms`,
  );
  expect(runs).toHaveLength(COUNT);
  expect(stats.shuffleRuns).toBeGreaterThan(0);
  expect(stats.lateRuns).toBeGreaterThan(0);
  expect(stats.boundaryRuns).toBeGreaterThan(0);
  expect(stats.minGapAfterValid).toBeGreaterThanOrEqual(MIN_GAP_MS.valid);
  expect(stats.minGapAfterInvalid).toBeGreaterThanOrEqual(MIN_GAP_MS.invalid);
});
