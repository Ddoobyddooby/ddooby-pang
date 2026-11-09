import { afterEach, describe, expect, it, vi } from 'vitest';

describe('키 없는 빌드 (.env.local 없음)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('온라인 기능만 꺼지고 어떤 호출도 throw하지 않는다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    const online = await import('../../src/online');
    expect(online.onlineStatus()).toBe('disabled');
    await expect(online.ensureAccount()).resolves.toBeUndefined();
    expect(online.onlineStatus()).toBe('disabled');
    expect(await online.getMyProfile()).toBe('error');
    expect(await online.setNickname('이안')).toEqual({ ok: false, code: 'network' });
    expect(await online.setNickname('가')).toEqual({ ok: false, code: 'too-short' });
    expect(online.formatTag(427)).toBe('#0427');
    expect(await online.startRun()).toBeNull();
    expect(await online.submitScore('run-1', { moves: [], clientScore: 0, version: 'v' })).toEqual({
      kind: 'failed',
    });
    expect(await online.fetchRanking()).toEqual({ kind: 'offline' });
    await expect(
      online.logStageAttempt({
        stageId: 1,
        result: 'clear',
        movesLeft: 2,
        score: 100,
        stars: 1,
        attemptNo: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
