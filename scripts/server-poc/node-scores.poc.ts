// V2-W2-08: seed 1~1000의 랜덤 로그와 Node 리플레이 점수를 out/node-scores.json에 쓴다.
// deno/compare.ts가 같은 로그를 Deno에서 다시 돌려 점수를 대조한다.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { randomLog } from './logs';
import { replayTimeAttack } from './replay';

const COUNT = 1000;
const OUT = join(__dirname, 'out');

test(`seed 1~${COUNT} 로그·점수 기록`, () => {
  const runs = Array.from({ length: COUNT }, (_, i) => {
    const seed = i + 1;
    const moves = randomLog(seed);
    return { seed, moves, result: replayTimeAttack(seed, moves) };
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, 'node-scores.json'),
    JSON.stringify({ runtime: `node ${process.version}`, runs }),
  );

  const scores = runs.map((r) => r.result.score).sort((a, b) => a - b);
  const moveCounts = runs.map((r) => r.moves.length);
  console.log(
    `[poc] ${COUNT}개 기록: 점수 ${scores[0]}~${scores[COUNT - 1]} (중앙 ${scores[COUNT >> 1]}),` +
      ` 수 ${Math.min(...moveCounts)}~${Math.max(...moveCounts)},` +
      ` 무효 ${runs.reduce((n, r) => n + r.result.invalidMoves, 0)}개,` +
      ` 마지막 팡 있음 ${runs.filter((r) => r.result.finaleScore > 0).length}판`,
  );
  expect(runs).toHaveLength(COUNT);
});
