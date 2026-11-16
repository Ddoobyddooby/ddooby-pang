import { describe, expect, it, vi } from 'vitest';
import {
  getStoryStarsClient,
  setStoryStarsClient,
  shouldSyncStars,
  syncStars,
  type StarsSyncResult,
} from '../../src/scenes/storyStarsSync';

const ctx = (over: Partial<Parameters<typeof shouldSyncStars>[0]> = {}) => ({
  devStage: false,
  demo: false,
  dev: false,
  search: '',
  ...over,
});

describe('shouldSyncStars (SYNC-10)', () => {
  it('운영 빌드의 일반 기록은 보낸다', () => {
    expect(shouldSyncStars(ctx())).toBe(true);
  });
  it('DEV는 ?starsync가 있을 때만 보낸다', () => {
    expect(shouldSyncStars(ctx({ dev: true }))).toBe(false);
    expect(shouldSyncStars(ctx({ dev: true, search: '?unlock=5' }))).toBe(false);
    expect(shouldSyncStars(ctx({ dev: true, search: '?starsync' }))).toBe(true);
  });
  it('?demo·시험 스테이지는 ?starsync가 있어도, 운영에서도 보내지 않는다', () => {
    for (const dev of [true, false]) {
      expect(shouldSyncStars(ctx({ dev, demo: true, search: '?starsync' }))).toBe(false);
      expect(shouldSyncStars(ctx({ dev, devStage: true, search: '?starsync' }))).toBe(false);
    }
  });
});

describe('syncStars', () => {
  const client = (fn: (s: Record<number, number>) => Promise<StarsSyncResult>) => ({
    syncStoryStars: vi.fn(fn),
  });

  it('SYNC-01/02 보낼 판이면 최고 별 전체의 복사본을 보낸다', async () => {
    const c = client(() => Promise.resolve({ kind: 'ok', total: 4 }));
    const best = { 1: 3, 2: 1 };
    await expect(syncStars(best, ctx(), c)).resolves.toEqual({ kind: 'ok', total: 4 });
    expect(c.syncStoryStars).toHaveBeenCalledWith({ 1: 3, 2: 1 });
    expect(c.syncStoryStars.mock.calls[0]![0]).not.toBe(best);
  });

  it('SYNC-10 제외된 판은 요청 없이 skipped', async () => {
    const c = client(() => Promise.resolve({ kind: 'ok', total: 0 }));
    await expect(syncStars({ 1: 3 }, ctx({ demo: true }), c)).resolves.toEqual({ kind: 'skipped' });
    await expect(syncStars({ 1: 3 }, ctx({ dev: true }), c)).resolves.toEqual({ kind: 'skipped' });
    expect(c.syncStoryStars).not.toHaveBeenCalled();
  });

  it('SYNC-02/05 실패·예외·오프라인은 throw하지 않고 결과로 돌려준다', async () => {
    const off = client(() => Promise.resolve({ kind: 'offline' }));
    await expect(syncStars({ 1: 1 }, ctx(), off)).resolves.toEqual({ kind: 'offline' });
    const boom = client(() => Promise.reject(new Error('x')));
    await expect(syncStars({ 1: 1 }, ctx(), boom)).resolves.toEqual({ kind: 'error' });
  });

  it('SYNC-05 실패 뒤 같은 전체 자료를 다시 보낼 수 있다 (여기서는 막지 않는다)', async () => {
    let n = 0;
    const c = client(() =>
      Promise.resolve(++n === 1 ? { kind: 'error' } : { kind: 'ok', total: 3 }),
    );
    await syncStars({ 1: 3 }, ctx(), c);
    await syncStars({ 1: 3 }, ctx(), c);
    expect(c.syncStoryStars).toHaveBeenCalledTimes(2);
  });

  it('꽂기 전에는 offline, 꽂으면 그 클라이언트를 쓴다', async () => {
    await expect(syncStars({ 1: 3 }, ctx())).resolves.toEqual({ kind: 'offline' });
    const c = client(() => Promise.resolve({ kind: 'ok', total: 3 }));
    const before = getStoryStarsClient();
    setStoryStarsClient(c);
    await syncStars({ 1: 3 }, ctx());
    expect(c.syncStoryStars).toHaveBeenCalledTimes(1);
    setStoryStarsClient(before);
  });
});
