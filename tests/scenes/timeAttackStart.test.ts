import { describe, expect, it, vi } from 'vitest';
import type { RunClient } from '../../src/scenes/runClient';
import { hasRankBlockingOption, prepareTimeAttack } from '../../src/scenes/timeAttackStart';

const run = { runId: 'r1', seed: 777 };
const client = (over: Partial<RunClient>): Pick<RunClient, 'startRun' | 'canRank'> => ({
  canRank: () => true,
  startRun: () => Promise.resolve(run),
  ...over,
});

describe('prepareTimeAttack', () => {
  it('run을 받으면 붙여서 시작한다', async () => {
    expect(await prepareTimeAttack(client({}), { blocked: false })).toEqual({
      mode: 'timeattack',
      run,
    });
  });

  it('startRun이 null이면 run 없이 + unranked', async () => {
    const data = await prepareTimeAttack(client({ startRun: () => Promise.resolve(null) }), {
      blocked: false,
    });
    expect(data).toEqual({ mode: 'timeattack', unranked: true });
  });

  it('startRun이 던져도 run 없이 + unranked', async () => {
    const data = await prepareTimeAttack(
      client({ startRun: () => Promise.reject(new Error('x')) }),
      {
        blocked: false,
      },
    );
    expect(data).toEqual({ mode: 'timeattack', unranked: true });
  });

  it('시간 초과면 기다리지 않고 run 없이 + unranked', async () => {
    vi.useFakeTimers();
    try {
      const pending = prepareTimeAttack(client({ startRun: () => new Promise(() => {}) }), {
        blocked: false,
        timeoutMs: 2500,
      });
      await vi.advanceTimersByTimeAsync(2499);
      let settled = false;
      void pending.then(() => (settled = true));
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({ mode: 'timeattack', unranked: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('서버를 쓸 수 없으면(오프라인·키 없음) startRun을 부르지 않고 줄 없이 바로', async () => {
    const startRun = vi.fn(() => Promise.resolve(run));
    const data = await prepareTimeAttack(client({ canRank: () => false, startRun }), {
      blocked: false,
    });
    expect(data).toEqual({ mode: 'timeattack' });
    expect(startRun).not.toHaveBeenCalled();
  });

  it('랭킹을 막는 옵션이면 run을 발급받지 않는다', async () => {
    const startRun = vi.fn(() => Promise.resolve(run));
    const data = await prepareTimeAttack(client({ startRun }), { blocked: true });
    expect(data).toEqual({ mode: 'timeattack' });
    expect(startRun).not.toHaveBeenCalled();
  });
});

describe('hasRankBlockingOption', () => {
  it('?seed는 어느 빌드에서나, ?time·?specials는 DEV에서만 막는다', () => {
    expect(hasRankBlockingOption('?seed=1', false)).toBe(true);
    expect(hasRankBlockingOption('?time=15', true)).toBe(true);
    expect(hasRankBlockingOption('?specials=combo', true)).toBe(true);
    expect(hasRankBlockingOption('?time=15&specials', false)).toBe(false);
  });

  it('상관없는 옵션이나 빈 주소는 막지 않는다', () => {
    expect(hasRankBlockingOption('', true)).toBe(false);
    expect(hasRankBlockingOption('?demo&hint=100&unlock=5', true)).toBe(false);
  });
});
