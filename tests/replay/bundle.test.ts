// 서버 번들 일치 (SPEC 10절, PLAN2 6.4): 1000개 랜덤 로그를 src의 replayTimeAttack·verifySubmission과
// 배포 번들 supabase/functions/_shared/replay.js(Node에서 import)로 각각 돌려 점수·판정·해시가 모두 같은지 본다.
// 번들이 src와 같은 코드인지는 CI의 server:shared:check가, Deno 런타임 일치는 npm run poc:deno가 본다
import { describe, expect, it } from 'vitest';
import { randomLog, SHUFFLE_SEEDS, type LogOptions } from '../../scripts/server-poc/logs';
import * as bundle from '../../supabase/functions/_shared/replay.js';
import { CORE_VERSION } from '../../src/replay/coreVersion';
import { submissionHash, verifySubmission } from '../../src/replay/judge';
import { replayTimeAttack } from '../../src/replay/replay';
import { weekKey } from '../../src/replay/weekKey';

const COUNT = 1000;
const SERVER = { version: CORE_VERSION, issuedAtMs: 0, submittedAtMs: 65_000 };
const SHUFFLE_BOARDS = Object.keys(SHUFFLE_SEEDS).map(Number);

/** node-scores.poc.ts와 같은 섞기: 10번째마다 늦은 move, 10번째 + 5마다 59999 경계, 마지막 2판은 셔플 보드 */
function logFor(i: number) {
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

describe('서버 번들 _shared/replay.js ↔ src/replay', () => {
  it('번들 끝의 CORE_VERSION은 src/replay/coreVersion.ts와 같은 12자리 hex', () => {
    expect(bundle.CORE_VERSION).toBe(CORE_VERSION);
    expect(CORE_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it(`랜덤 로그 ${COUNT}개: 리플레이 결과·서버 판정·제출 해시가 모두 같다`, async () => {
    const mismatches: number[] = [];
    let rejected = 0;
    for (let i = 1; i <= COUNT; i++) {
      const { seed, moves } = logFor(i);
      const src = replayTimeAttack(seed, moves);
      const out = bundle.replayTimeAttack(seed, moves);
      const submission = { moves, clientScore: src.score, version: SERVER.version };
      const srcVerdict = verifySubmission({ seed, ...submission }, SERVER);
      const outVerdict = bundle.verifySubmission({ seed, ...submission }, SERVER);
      if (!srcVerdict.ok) rejected++;
      const same =
        JSON.stringify(src) === JSON.stringify(out) &&
        JSON.stringify(srcVerdict) === JSON.stringify(outVerdict) &&
        (await submissionHash(submission)) === (await bundle.submissionHash(submission));
      if (!same) mismatches.push(i);
    }
    expect(mismatches).toEqual([]);
    // 늦은 move가 든 판(10번째마다)만 거부된다
    expect(rejected).toBe(COUNT / 10);
  }, 60_000); // 로그 만들기(힌트 탐색)가 대부분이다

  it('weekKey도 같다', () => {
    for (const ms of [0, Date.UTC(2026, 10, 8, 15), Date.UTC(2026, 11, 31, 23, 59)])
      expect(bundle.weekKey(ms)).toBe(weekKey(ms));
  });
});
