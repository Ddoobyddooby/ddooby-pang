// V2-W2-08: submit-score 서버 판정 (PLAN2 5.8 표) — move 시각·간격·좌표, 서버 시각, 재제출, 점수.
// 경계값 양쪽(통과/거부)과 codex 리뷰가 재현한 "모든 t를 0 또는 -1로 바꾼 로그", 실제 브라우저 기록 6판을 본다
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { randomLog } from '../../scripts/server-poc/logs';
import {
  replayTimeAttack,
  TIMEATTACK_BOARD,
  type ReplayMove,
} from '../../scripts/server-poc/replay';
import {
  checkServerTiming,
  JUDGE,
  resubmitDecision,
  submissionHash,
  validateMoves,
  verifySubmission,
} from '../../scripts/server-poc/validate';

const BOARD = TIMEATTACK_BOARD;
const move = (t: number, from = { r: 0, c: 0 }, to = { r: 0, c: 1 }): ReplayMove => ({
  from,
  to,
  t,
});
const reason = (moves: unknown) => {
  const v = validateMoves(moves, BOARD);
  return v.ok ? 'ok' : v.reason;
};
const SERVER = { version: 'abc123def456', issuedAtMs: 1_000_000, submittedAtMs: 1_065_000 };

const browserRuns = (
  JSON.parse(
    readFileSync(join(__dirname, '../../scripts/server-poc/fixtures/browser-runs.json'), 'utf8'),
  ) as { runs: { seed: number; kind: string; screenScore: number; moves: ReplayMove[] }[] }
).runs;

describe('server-poc/validate 판정 기준 (PLAN2 5.8)', () => {
  it('기준값은 PLAN 표와 같다', () => {
    expect(JUDGE).toEqual({
      limitMs: 60000,
      minGapMs: 200,
      minServerElapsedMs: 58000,
      runTtlMs: 1_800_000,
    });
  });

  describe('validateMoves: move 시각', () => {
    it('0 ≤ t < 60000: -1 거부, 0·59999 통과, 60000 거부', () => {
      expect(reason([move(-1)])).toBe('t-out-of-range');
      expect(reason([move(0)])).toBe('ok');
      expect(reason([move(59999)])).toBe('ok');
      expect(reason([move(60000)])).toBe('t-out-of-range');
      expect(reason([move(1000), move(60000)])).toBe('t-out-of-range');
    });

    it('t는 유한한 정수: NaN·Infinity·소수·문자열·없음 거부', () => {
      for (const t of [NaN, Infinity, 1.5, '100', undefined, null]) {
        expect(reason([{ ...move(0), t }])).toBe('t-not-integer');
      }
    });

    it('빈 로그는 통과, 배열이 아니면 거부', () => {
      expect(reason([])).toBe('ok');
      expect(reason(null)).toBe('moves-not-array');
      expect(reason({ length: 1 })).toBe('moves-not-array');
    });
  });

  describe('validateMoves: move 간격', () => {
    it('연속 간격 199 거부, 200 통과', () => {
      expect(reason([move(1000), move(1199)])).toBe('gap-too-short');
      expect(reason([move(1000), move(1200)])).toBe('ok');
    });

    it('같은 t와 역순도 거부, 거부한 move 번호를 알려 준다', () => {
      expect(validateMoves([move(1000), move(1000)], BOARD)).toEqual({
        ok: false,
        reason: 'gap-too-short',
        index: 1,
      });
      expect(reason([move(1000), move(1500), move(900)])).toBe('gap-too-short');
    });

    it('간격 규칙 때문에 60초 안의 move는 최대 300개', () => {
      const max = Array.from({ length: 300 }, (_, i) => move(i * JUDGE.minGapMs));
      expect(reason(max)).toBe('ok');
      expect(reason([...max, move(300 * JUDGE.minGapMs)])).toBe('t-out-of-range');
    });
  });

  describe('validateMoves: move 좌표', () => {
    it('보드 밖·음수·비정수·없는 좌표 거부', () => {
      expect(reason([move(0, { r: 7, c: 7 }, { r: 7, c: 6 })])).toBe('ok');
      expect(reason([move(0, { r: 7, c: 7 }, { r: 8, c: 7 })])).toBe('pos-invalid');
      expect(reason([move(0, { r: -1, c: 0 }, { r: 0, c: 0 })])).toBe('pos-invalid');
      expect(reason([move(0, { r: 0.5, c: 0 }, { r: 1, c: 0 })])).toBe('pos-invalid');
      expect(reason([{ to: { r: 0, c: 1 }, t: 0 }])).toBe('pos-invalid');
      expect(reason([{ from: { r: '0', c: 0 }, to: { r: 0, c: 1 }, t: 0 }])).toBe('pos-invalid');
    });

    it('상하좌우 이웃만: 대각선·두 칸·같은 칸 거부', () => {
      expect(reason([move(0, { r: 3, c: 3 }, { r: 2, c: 3 })])).toBe('ok');
      expect(reason([move(0, { r: 3, c: 3 }, { r: 4, c: 4 })])).toBe('not-adjacent');
      expect(reason([move(0, { r: 3, c: 3 }, { r: 3, c: 5 })])).toBe('not-adjacent');
      expect(reason([move(0, { r: 3, c: 3 }, { r: 3, c: 3 })])).toBe('not-adjacent');
    });
  });

  describe('checkServerTiming: 서버 시각', () => {
    const at = (elapsed: number) => {
      const v = checkServerTiming(1000, 1000 + elapsed);
      return v.ok ? 'ok' : v.reason;
    };
    it('발급 → 도착 57999ms 거부, 58000ms 통과', () => {
      expect(at(57999)).toBe('too-fast');
      expect(at(58000)).toBe('ok');
      expect(at(-1)).toBe('too-fast');
      expect(at(NaN)).toBe('too-fast');
    });
    it('30분 − 1ms 통과, 30분 만료', () => {
      expect(at(30 * 60_000 - 1)).toBe('ok');
      expect(at(30 * 60_000)).toBe('expired');
    });
  });

  describe('재제출: submissionHash + resubmitDecision', () => {
    const payload = { moves: randomLog(1), clientScore: 1234, version: 'v1' };

    it('처음이면 new, 같은 내용이면 same, 다른 내용이면 conflict', async () => {
      const hash = await submissionHash(payload);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(resubmitDecision(null, hash)).toBe('new');
      // 같은 내용: 키 순서·다른 필드가 달라도 같은 해시
      const reordered = {
        version: 'v1',
        clientScore: 1234,
        moves: payload.moves.map((m) => ({ t: m.t, to: { c: m.to.c, r: m.to.r }, from: m.from })),
        runId: 'ignored',
      };
      expect(resubmitDecision(hash, await submissionHash(reordered))).toBe('same');
      // 다른 내용: 점수·버전·move 하나만 달라도
      const other = [
        { ...payload, clientScore: 1235 },
        { ...payload, version: 'v2' },
        { ...payload, moves: [...payload.moves.slice(0, -1), { ...payload.moves.at(-1)!, t: 1 }] },
      ];
      for (const p of other)
        expect(resubmitDecision(hash, await submissionHash(p))).toBe('conflict');
    });
  });

  describe('verifySubmission: 버전 → 서버 시각 → move → 리플레이 → 점수', () => {
    const seed = 1;
    const log = randomLog(seed, seed, { realistic: true });
    const score = replayTimeAttack(seed, log).score;
    const submit = (over: Record<string, unknown> = {}, server = SERVER) =>
      verifySubmission(
        { seed, moves: log, clientScore: score, version: SERVER.version, ...over },
        server,
      );

    it('정상 제출은 통과하고 리플레이 점수를 돌려준다', () => {
      expect(submit()).toMatchObject({ ok: true, score });
    });

    it('점수 불일치 거부 (1점 차이도)', () => {
      expect(submit({ clientScore: score + 1 })).toEqual({ ok: false, reason: 'score-mismatch' });
      expect(submit({ clientScore: String(score) })).toEqual({
        ok: false,
        reason: 'score-mismatch',
      });
    });

    it('버전·서버 시각이 먼저다', () => {
      expect(submit({ version: 'old' })).toEqual({ ok: false, reason: 'version-mismatch' });
      expect(submit({}, { ...SERVER, submittedAtMs: SERVER.issuedAtMs + 57999 })).toEqual({
        ok: false,
        reason: 'too-fast',
      });
      expect(submit({}, { ...SERVER, submittedAtMs: SERVER.issuedAtMs + JUDGE.runTtlMs })).toEqual({
        ok: false,
        reason: 'expired',
      });
    });

    it('codex 재현: seed 1 로그의 t를 모두 0 또는 -1로 바꾸면 거부 (점수가 맞아도)', () => {
      const original = randomLog(1);
      const points = replayTimeAttack(1, original).score;
      const allZero = original.map((m) => ({ ...m, t: 0 }));
      const allMinus = original.map((m) => ({ ...m, t: -1 }));
      // 리플레이 점수는 그대로라 점수 비교만으로는 못 막는다
      expect(replayTimeAttack(1, allZero).score).toBe(points);
      const verdict = (moves: ReplayMove[]) =>
        verifySubmission({ seed: 1, moves, clientScore: points, version: SERVER.version }, SERVER);
      expect(verdict(allZero)).toEqual({ ok: false, reason: 'gap-too-short', index: 1 });
      expect(verdict(allMinus)).toEqual({ ok: false, reason: 't-out-of-range', index: 0 });
    });

    it('늦은 move가 든 로그는 거부, 59999 경계 로그는 통과', () => {
      const late = randomLog(10, 10, { realistic: true, late: 1 });
      const lateScore = replayTimeAttack(10, late.slice(0, -1)).score;
      expect(
        verifySubmission(
          { seed: 10, moves: late, clientScore: lateScore, version: SERVER.version },
          SERVER,
        ),
      ).toEqual({ ok: false, reason: 't-out-of-range', index: late.length - 1 });

      const boundary = [5, 15, 25, 35]
        .map((s) => ({ s, moves: randomLog(s, s, { realistic: true, boundary: true }) }))
        .find(({ moves }) => moves.at(-1)!.t === JUDGE.limitMs - 1)!;
      const points = replayTimeAttack(boundary.s, boundary.moves).score;
      expect(
        verifySubmission(
          { seed: boundary.s, moves: boundary.moves, clientScore: points, version: SERVER.version },
          SERVER,
        ),
      ).toMatchObject({ ok: true, score: points });
    });

    it.each(browserRuns.map((run) => [`${run.kind} seed ${run.seed}`, run] as const))(
      '실제 브라우저 기록 %s: 화면 점수로 제출하면 통과',
      (_, run) => {
        const verdict = verifySubmission(
          {
            seed: run.seed,
            moves: run.moves,
            clientScore: run.screenScore,
            version: SERVER.version,
          },
          SERVER,
        );
        expect(verdict).toMatchObject({ ok: true, score: run.screenScore });
      },
    );
  });
});
