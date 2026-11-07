// submit-score 처리 로직 (PLAN2 5.8·6.4): 가짜 DB(runs·weekly_scores)로 판정·판정 저장·재제출·주간 최고 점수를 본다
import { describe, expect, it, vi } from 'vitest';
import {
  handleSubmitScore,
  type RunRow,
  type StoredResult,
  type SubmitScoreDeps,
} from '../../supabase/functions/submit-score/handler';
import { randomLog } from '../../scripts/server-poc/logs';
import { JUDGE } from '../../src/replay/judge';
import { replayTimeAttack } from '../../src/replay/replay';

const ORIGIN = 'https://ddoobyddooby.github.io';
const URL = 'https://example.supabase.co/functions/v1/submit-score';
const VERSION = 'abc123def456';
const ISSUED = 1_000_000;
const WEEK = '2026-W45';
const RUN_A = '11111111-1111-4111-8111-111111111111';
const RUN_A2 = '22222222-2222-4222-8222-222222222222';
const RUN_B = '33333333-3333-4333-8333-333333333333';

const SEED = 1;
const MOVES = randomLog(SEED, SEED, { realistic: true });
const SCORE = replayTimeAttack(SEED, MOVES).score;
const GOOD = { moves: MOVES, clientScore: SCORE, version: VERSION };

/** 가짜 DB: runs는 사용자별, weekly_scores는 (user, week)별. claimRun은 submission_hash is null일 때만 쓴다 */
function fakeDeps() {
  const runs = new Map<string, RunRow & { userId: string; submittedAtMs: number | null }>();
  const weekly = new Map<string, { best: number; runId: string }>();
  const addRun = (id: string, userId: string, seed = SEED, version = VERSION) =>
    runs.set(id, {
      id,
      userId,
      seed,
      version,
      weekKey: WEEK,
      createdAtMs: ISSUED,
      submissionHash: null,
      result: null,
      submittedAtMs: null,
    });
  addRun(RUN_A, 'user-a');
  addRun(RUN_A2, 'user-a');
  addRun(RUN_B, 'user-b');

  let now = ISSUED + 61_000;
  const deps = {
    allowHeaders: 'authorization, x-client-info, apikey, content-type',
    version: VERSION,
    now: vi.fn(() => now),
    getUserId: vi.fn(async (token: string) =>
      token === 'token-a' ? 'user-a' : token === 'token-b' ? 'user-b' : null,
    ),
    getRun: vi.fn(async (runId: string, userId: string): Promise<RunRow | null> => {
      const row = runs.get(runId);
      if (!row || row.userId !== userId) return null;
      return structuredClone({
        id: row.id,
        seed: row.seed,
        version: row.version,
        weekKey: row.weekKey,
        createdAtMs: row.createdAtMs,
        submissionHash: row.submissionHash,
        result: row.result,
      });
    }),
    claimRun: vi.fn(
      async (runId: string, hash: string, result: StoredResult, submittedAtMs: number) => {
        const row = runs.get(runId)!;
        if (row.submissionHash !== null) return false;
        Object.assign(row, {
          submissionHash: hash,
          result: structuredClone(result),
          submittedAtMs,
        });
        return true;
      },
    ),
    saveResult: vi.fn(async (runId: string, result: StoredResult) => {
      runs.get(runId)!.result = structuredClone(result);
    }),
    recordWeeklyBest: vi.fn(async (userId: string, week: string, score: number, runId: string) => {
      const key = `${userId}/${week}`;
      const cur = weekly.get(key);
      const isNewBest = !cur || score > cur.best;
      if (isNewBest) weekly.set(key, { best: score, runId });
      return { best: weekly.get(key)!.best, isNewBest };
    }),
  } satisfies SubmitScoreDeps;
  return { deps, runs, weekly, setNow: (ms: number) => (now = ms), addRun };
}

function post(body: unknown, token: string | null = 'token-a'): Request {
  return new Request(URL, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const read = async (res: Response) => ({ status: res.status, body: await res.json() });
const submit = (deps: SubmitScoreDeps, body: unknown, token?: string | null) =>
  handleSubmitScore(deps, post(body, token)).then(read);

describe('handleSubmitScore', () => {
  it('정상 → 200 {ok, score, best, weekKey, isNewBest}, run에 해시·결과·제출 시각, weekly_scores 반영', async () => {
    const { deps, runs, weekly } = fakeDeps();
    expect(await submit(deps, { runId: RUN_A, ...GOOD })).toEqual({
      status: 200,
      body: { ok: true, score: SCORE, best: SCORE, weekKey: WEEK, isNewBest: true },
    });
    const row = runs.get(RUN_A)!;
    expect(row.submissionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.submittedAtMs).toBe(ISSUED + 61_000);
    expect(row.result).toMatchObject({ ok: true, score: SCORE, best: SCORE, isNewBest: true });
    expect(weekly.get(`user-a/${WEEK}`)).toEqual({ best: SCORE, runId: RUN_A });
    expect(deps.recordWeeklyBest).toHaveBeenCalledWith('user-a', WEEK, SCORE, RUN_A);
  });

  it('같은 내용 재제출 → 저장된 같은 200, 다시 기록하지 않는다 (30분이 지나도)', async () => {
    const { deps, setNow } = fakeDeps();
    const first = await submit(deps, { runId: RUN_A, ...GOOD });
    setNow(ISSUED + JUDGE.runTtlMs + 1);
    expect(await submit(deps, { ...GOOD, runId: RUN_A })).toEqual(first);
    expect(deps.recordWeeklyBest).toHaveBeenCalledTimes(1);
  });

  it('다른 내용으로 run 재사용 → 409 resubmit-conflict, 기록 그대로', async () => {
    const { deps, weekly } = fakeDeps();
    await submit(deps, { runId: RUN_A, ...GOOD });
    expect(await submit(deps, { runId: RUN_A, ...GOOD, moves: MOVES.slice(0, -1) })).toEqual({
      status: 409,
      body: { ok: false, code: 'resubmit-conflict' },
    });
    expect(weekly.get(`user-a/${WEEK}`)?.best).toBe(SCORE);
  });

  it('too-fast는 저장하지 않는다: 58초 뒤 같은 내용 재시도는 통과', async () => {
    const { deps, runs, setNow } = fakeDeps();
    setNow(ISSUED + JUDGE.minServerElapsedMs - 1);
    expect(await submit(deps, { runId: RUN_A, ...GOOD })).toEqual({
      status: 400,
      body: { ok: false, code: 'too-fast' },
    });
    expect(runs.get(RUN_A)!.submissionHash).toBeNull();
    expect(deps.claimRun).not.toHaveBeenCalled();
    setNow(ISSUED + JUDGE.minServerElapsedMs);
    expect((await submit(deps, { runId: RUN_A, ...GOOD })).status).toBe(200);
  });

  it('expired는 저장한다: 같은 내용 재제출도 같은 거부, 기록 없음', async () => {
    const { deps, runs, weekly, setNow } = fakeDeps();
    setNow(ISSUED + JUDGE.runTtlMs);
    const expired = { status: 400, body: { ok: false, code: 'expired' } };
    expect(await submit(deps, { runId: RUN_A, ...GOOD })).toEqual(expired);
    expect(runs.get(RUN_A)!.result).toEqual({ ok: false, reason: 'expired' });
    expect(await submit(deps, { runId: RUN_A, ...GOOD })).toEqual(expired);
    expect(weekly.size).toBe(0);
  });

  it('점수 조작 → 400 score-mismatch 저장, 맞는 점수로 다시 내도 conflict', async () => {
    const { deps, weekly } = fakeDeps();
    expect(await submit(deps, { runId: RUN_A, ...GOOD, clientScore: SCORE + 10 })).toEqual({
      status: 400,
      body: { ok: false, code: 'score-mismatch' },
    });
    expect((await submit(deps, { runId: RUN_A, ...GOOD })).body.code).toBe('resubmit-conflict');
    expect(weekly.size).toBe(0);
  });

  it('제출 버전이 서버와 다르면 409 version-mismatch', async () => {
    const { deps } = fakeDeps();
    expect(await submit(deps, { runId: RUN_A, ...GOOD, version: 'old000000000' })).toEqual({
      status: 409,
      body: { ok: false, code: 'version-mismatch' },
    });
  });

  it('발급 뒤 서버 코어가 바뀐 run → 409 version-mismatch, 저장 안 함', async () => {
    const { deps, runs, addRun } = fakeDeps();
    addRun(RUN_A, 'user-a', SEED, 'old000000000');
    expect((await submit(deps, { runId: RUN_A, ...GOOD })).status).toBe(409);
    expect(runs.get(RUN_A)!.submissionHash).toBeNull();
  });

  it('남의 run·없는 run·uuid 아닌 runId → 404, runId 형식 오류 → 400', async () => {
    const { deps, runs } = fakeDeps();
    const notFound = { status: 404, body: { code: 'not-found' } };
    expect(await submit(deps, { runId: RUN_A, ...GOOD }, 'token-b')).toEqual(notFound);
    expect(runs.get(RUN_A)!.submissionHash).toBeNull();
    expect(await submit(deps, { runId: '44444444-4444-4444-8444-444444444444', ...GOOD })).toEqual(
      notFound,
    );
    expect(await submit(deps, { runId: 'not-a-uuid', ...GOOD })).toEqual(notFound);
    expect(deps.getRun).toHaveBeenCalledTimes(2); // uuid가 아니면 DB에 묻지 않는다
    for (const body of [{ ...GOOD }, { runId: 1, ...GOOD }, 'null', '{x', '"str"']) {
      expect(await submit(deps, body)).toEqual({
        status: 400,
        body: { ok: false, code: 'payload-invalid' },
      });
    }
  });

  it('형식 오류 payload → 400, run에 저장하지 않는다', async () => {
    const { deps, runs } = fakeDeps();
    expect(await submit(deps, { runId: RUN_A, ...GOOD, moves: null })).toEqual({
      status: 400,
      body: { ok: false, code: 'moves-not-array' },
    });
    expect(await submit(deps, { runId: RUN_A, ...GOOD, clientScore: -1 })).toEqual({
      status: 400,
      body: { ok: false, code: 'client-score-invalid' },
    });
    expect(runs.get(RUN_A)!.submissionHash).toBeNull();
  });

  it('최고 점수가 아니면 best 그대로, isNewBest false', async () => {
    const { deps, weekly } = fakeDeps();
    await submit(deps, { runId: RUN_A, ...GOOD });
    const low = { moves: [], clientScore: replayTimeAttack(SEED, []).score, version: VERSION };
    expect(low.clientScore).toBeLessThan(SCORE);
    expect(await submit(deps, { runId: RUN_A2, ...low })).toEqual({
      status: 200,
      body: { ok: true, score: low.clientScore, best: SCORE, weekKey: WEEK, isNewBest: false },
    });
    expect(weekly.get(`user-a/${WEEK}`)).toEqual({ best: SCORE, runId: RUN_A });
  });

  it('동시 제출: 다른 요청이 같은 내용을 먼저 저장했으면 그 결과, 다른 내용이면 409', async () => {
    const { deps, runs } = fakeDeps();
    // 먼저 읽은 run(해시 없음)을 돌려주고, 저장 직전에 다른 요청이 끼어든다
    const before = (await deps.getRun(RUN_A, 'user-a'))!;
    deps.getRun.mockResolvedValueOnce(before);
    deps.claimRun.mockImplementationOnce(async () => {
      await handleSubmitScore(deps, post({ runId: RUN_A, ...GOOD }));
      return false;
    });
    expect(await submit(deps, { runId: RUN_A, ...GOOD })).toEqual({
      status: 200,
      body: { ok: true, score: SCORE, best: SCORE, weekKey: WEEK, isNewBest: true },
    });

    const { deps: deps2 } = fakeDeps();
    deps2.getRun.mockResolvedValueOnce((await deps2.getRun(RUN_A, 'user-a'))!);
    deps2.claimRun.mockImplementationOnce(async () => {
      await handleSubmitScore(deps2, post({ runId: RUN_A, ...GOOD, clientScore: SCORE + 1 }));
      return false;
    });
    expect((await submit(deps2, { runId: RUN_A, ...GOOD })).body.code).toBe('resubmit-conflict');
    expect(runs.get(RUN_A)!.result).toMatchObject({ ok: true });
  });

  it('기록 뒤 결과 저장이 실패하면 500, 같은 내용 재시도는 다시 기록해(바뀌지 않음) 200', async () => {
    const { deps, weekly } = fakeDeps();
    deps.saveResult.mockRejectedValueOnce(new Error('db down'));
    expect(await submit(deps, { runId: RUN_A, ...GOOD })).toEqual({
      status: 500,
      body: { code: 'server' },
    });
    expect(weekly.get(`user-a/${WEEK}`)?.best).toBe(SCORE);
    const retry = await submit(deps, { runId: RUN_A, ...GOOD });
    expect(retry).toMatchObject({ status: 200, body: { ok: true, best: SCORE } });
    expect(deps.recordWeeklyBest).toHaveBeenCalledTimes(2);
  });

  it('토큰 없음·무효 → 401, run을 읽지 않는다', async () => {
    const { deps } = fakeDeps();
    expect((await submit(deps, { runId: RUN_A, ...GOOD }, null)).status).toBe(401);
    expect((await submit(deps, { runId: RUN_A, ...GOOD }, 'bad')).status).toBe(401);
    expect(deps.getRun).not.toHaveBeenCalled();
  });

  it('DB 오류 → 500 server', async () => {
    const { deps } = fakeDeps();
    deps.getRun.mockRejectedValueOnce(new Error('db down'));
    expect(await submit(deps, { runId: RUN_A, ...GOOD })).toEqual({
      status: 500,
      body: { code: 'server' },
    });
  });

  it('CORS: 허용 출처 응답에 허용 헤더, 허용 안 된 출처 preflight 403', async () => {
    const { deps } = fakeDeps();
    const res = await handleSubmitScore(deps, post({ runId: RUN_A, ...GOOD }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const evil = await handleSubmitScore(
      deps,
      new Request(URL, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }),
    );
    expect(evil.status).toBe(403);
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
