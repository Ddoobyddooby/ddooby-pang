// 스토리 플레이 로그 클라이언트 (PLAN2 6.7): 보내는 열, 키 없음·오프라인·계정 없음·오류·시간 초과에서 throw 없음. 가짜 계정·백엔드를 주입한다
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, OnlineStatus } from '../../src/online/account';
import { ATTEMPT_TIMEOUT_MS, createAttempts, type StageAttempt } from '../../src/online/attempts';
import type { OnlineBackend } from '../../src/online/client';

const ATTEMPT: StageAttempt = {
  stageId: 3,
  result: 'clear',
  movesLeft: 4,
  score: 5200,
  stars: 2,
  attemptNo: 7,
};

function backendWith(
  insert: (table: string, row: Record<string, unknown>) => Promise<'ok' | 'error'>,
) {
  return {
    getSessionUserId: vi.fn(async () => 'me'),
    signInAnonymously: vi.fn(async () => 'me'),
    onSignedOut: vi.fn(),
    fetchProfile: vi.fn(async () => null),
    callFunction: vi.fn(async () => 'network' as const),
    callRpc: vi.fn(async () => 'error' as const),
    insertRow: vi.fn(insert),
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

const attemptsFor = (account: Account, isOnline = true) =>
  createAttempts(account, { isOnline: () => isOnline });

afterEach(() => vi.useRealTimers());

describe('logStageAttempt', () => {
  it('stage_attempts에 6개 열만 INSERT한다 (user_id·id·created_at은 서버 기본값)', async () => {
    const backend = backendWith(async () => 'ok');
    await expect(
      attemptsFor(fakeAccount(backend)).logStageAttempt(ATTEMPT),
    ).resolves.toBeUndefined();
    expect(backend.insertRow).toHaveBeenCalledTimes(1);
    expect(backend.insertRow).toHaveBeenCalledWith('stage_attempts', {
      stage_id: 3,
      result: 'clear',
      moves_left: 4,
      score: 5200,
      stars: 2,
      attempt_no: 7,
    });
    const row = backend.insertRow.mock.calls[0]![1];
    expect(Object.keys(row).sort()).toEqual(
      ['attempt_no', 'moves_left', 'result', 'score', 'stage_id', 'stars'].sort(),
    );
    for (const serverColumn of ['user_id', 'id', 'created_at']) {
      expect(row).not.toHaveProperty(serverColumn);
    }
  });

  it('실패 판은 result fail로 보낸다', async () => {
    const backend = backendWith(async () => 'ok');
    await attemptsFor(fakeAccount(backend)).logStageAttempt({
      ...ATTEMPT,
      result: 'fail',
      movesLeft: 0,
      stars: 0,
      attemptNo: 1,
    });
    expect(backend.insertRow).toHaveBeenCalledWith('stage_attempts', {
      stage_id: 3,
      result: 'fail',
      moves_left: 0,
      score: 5200,
      stars: 0,
      attempt_no: 1,
    });
  });

  it('계정이 아직이면 ensure로 로그인한 뒤 보낸다', async () => {
    const backend = backendWith(async () => 'ok');
    const account = fakeAccount(backend, 'offline');
    await attemptsFor(account).logStageAttempt(ATTEMPT);
    expect(account.ensure).toHaveBeenCalled();
    expect(backend.insertRow).toHaveBeenCalledTimes(1);
  });

  it('키 없음·오프라인이면 로그인도 요청도 하지 않고 바로 끝난다', async () => {
    const backend = backendWith(async () => 'ok');
    const disabled = fakeAccount(backend, 'disabled');
    await expect(attemptsFor(disabled).logStageAttempt(ATTEMPT)).resolves.toBeUndefined();
    const offline = fakeAccount(backend);
    await expect(attemptsFor(offline, false).logStageAttempt(ATTEMPT)).resolves.toBeUndefined();
    expect(disabled.ensure).not.toHaveBeenCalled();
    expect(offline.ensure).not.toHaveBeenCalled();
    expect(backend.insertRow).not.toHaveBeenCalled();
  });

  it('계정 없음(로그인 실패) → 보내지 않고 끝난다', async () => {
    await expect(
      attemptsFor(fakeAccount(null, 'offline')).logStageAttempt(ATTEMPT),
    ).resolves.toBeUndefined();
  });

  it('서버 오류·throw·ensure 실패에도 throw하지 않는다 (다시 보내지 않는다)', async () => {
    const error = backendWith(async () => 'error');
    await expect(attemptsFor(fakeAccount(error)).logStageAttempt(ATTEMPT)).resolves.toBeUndefined();
    expect(error.insertRow).toHaveBeenCalledTimes(1);

    const boom = backendWith(async () => {
      throw new Error('boom');
    });
    await expect(attemptsFor(fakeAccount(boom)).logStageAttempt(ATTEMPT)).resolves.toBeUndefined();

    const account = fakeAccount(error, 'offline');
    account.ensure.mockRejectedValueOnce(new Error('ensure'));
    await expect(attemptsFor(account).logStageAttempt(ATTEMPT)).resolves.toBeUndefined();
  });

  it(`${ATTEMPT_TIMEOUT_MS}ms 안에 답이 없으면 기다리지 않고 끝난다`, async () => {
    vi.useFakeTimers();
    const backend = backendWith(
      () => new Promise((resolve) => setTimeout(() => resolve('ok'), 60_000)),
    );
    const pending = attemptsFor(fakeAccount(backend)).logStageAttempt(ATTEMPT);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(ATTEMPT_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    await expect(pending).resolves.toBeUndefined();
    expect(ATTEMPT_TIMEOUT_MS).toBe(5000);
  });
});
