// 경쟁 모드 run 발급·점수 제출 클라이언트 (PLAN2 6.4): 시간 초과·오프라인·응답 매핑. 가짜 계정·백엔드를 주입한다
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, OnlineStatus } from '../../src/online/account';
import type { FunctionResult, OnlineBackend } from '../../src/online/client';
import { createRuns, START_RUN_TIMEOUT_MS, SUBMIT_TIMEOUT_MS } from '../../src/online/runs';

const VERSION = 'abc123def456';
const PAYLOAD = {
  moves: [{ from: { r: 0, c: 0 }, to: { r: 0, c: 1 }, t: 100 }],
  clientScore: 120,
  version: VERSION,
};

function backendWith(result: FunctionResult | (() => Promise<FunctionResult>)) {
  return {
    getSessionUserId: vi.fn(async () => 'me'),
    signInAnonymously: vi.fn(async () => 'me'),
    onSignedOut: vi.fn(),
    fetchProfile: vi.fn(async () => null),
    callFunction: vi.fn(typeof result === 'function' ? result : async () => result),
    callRpc: vi.fn(async () => 'error' as const),
    insertRow: vi.fn(async () => 'error' as const),
  } satisfies OnlineBackend;
}

function fakeAccount(backend: OnlineBackend | null, initial: OnlineStatus = 'ready') {
  let status = initial;
  return {
    status: () => status,
    ensure: vi.fn(async () => {
      if (status === 'offline' && backend) status = 'ready';
    }),
    userId: () => (status === 'ready' ? 'me' : null),
    backend: () => (status === 'ready' ? backend : null),
  } satisfies Account;
}

const runsFor = (account: Account, isOnline = true) =>
  createRuns(account, { version: VERSION, isOnline: () => isOnline });

afterEach(() => vi.useRealTimers());

describe('startRun', () => {
  it('200 → {runId, seed}, 클라이언트 version을 보낸다', async () => {
    const backend = backendWith({ status: 200, body: { runId: 'run-1', seed: 42 } });
    expect(await runsFor(fakeAccount(backend)).startRun()).toEqual({ runId: 'run-1', seed: 42 });
    expect(backend.callFunction).toHaveBeenCalledWith('start-run', { version: VERSION });
  });

  it('계정이 아직이면 ensure로 로그인한 뒤 발급받는다', async () => {
    const backend = backendWith({ status: 200, body: { runId: 'run-1', seed: 0 } });
    const account = fakeAccount(backend, 'offline');
    expect(await runsFor(account).startRun()).toEqual({ runId: 'run-1', seed: 0 });
    expect(account.ensure).toHaveBeenCalled();
  });

  it('키 없음·오프라인이면 부르지 않고 null', async () => {
    const backend = backendWith({ status: 200, body: { runId: 'run-1', seed: 1 } });
    expect(await runsFor(fakeAccount(backend, 'disabled')).startRun()).toBeNull();
    expect(await runsFor(fakeAccount(backend), false).startRun()).toBeNull();
    expect(backend.callFunction).not.toHaveBeenCalled();
  });

  it('계정 없음(로그인 실패)·네트워크·오류 응답·이상한 본문·throw → null', async () => {
    expect(await runsFor(fakeAccount(null, 'offline')).startRun()).toBeNull();
    const cases: (FunctionResult | (() => Promise<FunctionResult>))[] = [
      'network',
      { status: 409, body: { code: 'version-mismatch' } },
      { status: 500, body: { code: 'server' } },
      { status: 200, body: { runId: 'run-1' } },
      { status: 200, body: { runId: '', seed: 1 } },
      { status: 200, body: { runId: 'run-1', seed: 1.5 } },
      { status: 200, body: null },
      async () => {
        throw new Error('boom');
      },
    ];
    for (const result of cases)
      expect(await runsFor(fakeAccount(backendWith(result))).startRun()).toBeNull();
  });

  it(`${START_RUN_TIMEOUT_MS}ms 안에 답이 없으면 null (늦게 온 답은 버린다)`, async () => {
    vi.useFakeTimers();
    const backend = backendWith(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 200, body: { runId: 'late', seed: 1 } }), 3000),
        ),
    );
    const pending = runsFor(fakeAccount(backend)).startRun();
    await vi.advanceTimersByTimeAsync(START_RUN_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBeNull();
    expect(START_RUN_TIMEOUT_MS).toBe(2500);
  });
});

describe('submitScore', () => {
  const submitWith = (result: FunctionResult | (() => Promise<FunctionResult>)) => {
    const backend = backendWith(result);
    return { backend, outcome: runsFor(fakeAccount(backend)).submitScore('run-1', PAYLOAD) };
  };

  it('200 → ok {best, isNewBest}, runId·moves·clientScore·version을 보낸다', async () => {
    const { backend, outcome } = submitWith({
      status: 200,
      body: { ok: true, score: 120, best: 300, weekKey: '2026-W45', isNewBest: false },
    });
    expect(await outcome).toEqual({ kind: 'ok', best: 300, isNewBest: false });
    expect(backend.callFunction).toHaveBeenCalledWith('submit-score', {
      runId: 'run-1',
      ...PAYLOAD,
    });
  });

  it.each([
    [{ status: 409, body: { ok: false, code: 'version-mismatch' } }, { kind: 'outdated' }],
    [
      { status: 409, body: { ok: false, code: 'resubmit-conflict' } },
      { kind: 'rejected', code: 'resubmit-conflict' },
    ],
    [
      { status: 400, body: { ok: false, code: 'score-mismatch' } },
      { kind: 'rejected', code: 'score-mismatch' },
    ],
    [
      { status: 400, body: { ok: false, code: 'too-fast' } },
      { kind: 'rejected', code: 'too-fast' },
    ],
    [
      { status: 404, body: { code: 'not-found' } },
      { kind: 'rejected', code: 'not-found' },
    ],
    [
      { status: 400, body: null },
      { kind: 'rejected', code: 'http-400' },
    ],
    [{ status: 401, body: { code: 'unauthorized' } }, { kind: 'failed' }],
    [{ status: 500, body: { code: 'server' } }, { kind: 'failed' }],
    [{ status: 502, body: null }, { kind: 'failed' }],
    [{ status: 200, body: { ok: true, best: '300', isNewBest: true } }, { kind: 'failed' }],
    [{ status: 409, body: null }, { kind: 'failed' }],
    ['network', { kind: 'failed' }],
  ] as const)('%j → %j', async (result, expected) => {
    expect(await submitWith(result as FunctionResult).outcome).toEqual(expected);
  });

  it('계정 없음·throw → failed', async () => {
    expect(await runsFor(fakeAccount(null, 'offline')).submitScore('run-1', PAYLOAD)).toEqual({
      kind: 'failed',
    });
    const { outcome } = submitWith(async () => {
      throw new Error('boom');
    });
    expect(await outcome).toEqual({ kind: 'failed' });
  });

  it(`${SUBMIT_TIMEOUT_MS}ms 안에 답이 없으면 failed`, async () => {
    vi.useFakeTimers();
    const { outcome } = submitWith(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
    expect(await outcome).toEqual({ kind: 'failed' });
  });
});
