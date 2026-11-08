// 주간 랭킹 클라이언트 (PLAN2 6.5): offline·error(시간 초과·서버 오류·네트워크)·응답 매핑. 가짜 계정·백엔드를 주입한다
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, OnlineStatus } from '../../src/online/account';
import type { OnlineBackend, RpcResult } from '../../src/online/client';
import { createRanking, RANKING_TIMEOUT_MS } from '../../src/online/ranking';

const WEEK = '2026-W45';

function backendWith(result: RpcResult | (() => Promise<RpcResult>)) {
  return {
    getSessionUserId: vi.fn(async () => 'me'),
    signInAnonymously: vi.fn(async () => 'me'),
    onSignedOut: vi.fn(),
    fetchProfile: vi.fn(async () => null),
    callFunction: vi.fn(async () => 'network' as const),
    callRpc: vi.fn(typeof result === 'function' ? result : async () => result),
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

const rankingFor = (account: Account, isOnline = true) =>
  createRanking(account, { isOnline: () => isOnline, currentWeek: () => '2026-W46' });

/** DB 함수 weekly_ranking의 한 행 */
const row = (
  section: 'top' | 'around' | 'me',
  seq: number | null,
  rank: number | null,
  score: number,
  over: Record<string, unknown> = {},
) => ({
  week_key: WEEK,
  section,
  seq,
  rank,
  nickname: seq === null ? null : `사람${seq}`,
  tag: seq === null ? null : seq,
  best_score: score,
  is_me: false,
  ...over,
});

afterEach(() => vi.useRealTimers());

describe('fetchRanking', () => {
  it('정상 응답 → top·around·me 매핑, 인자 없이 weekly_ranking 한 번', async () => {
    const backend = backendWith({
      data: [
        row('top', 1, 1, 100),
        row('top', 2, 2, 90),
        row('top', 3, 2, 90, { nickname: '열글자닉네임이에요', tag: 427 }),
        row('top', 4, 4, 80, { is_me: true }),
        row('around', 1, 1, 100),
        row('around', 4, 4, 80, { is_me: true }),
        row('me', 4, 4, 80, { is_me: true }),
      ],
    });
    expect(await rankingFor(fakeAccount(backend)).fetchRanking()).toEqual({
      kind: 'ok',
      weekKey: WEEK,
      top: [
        { seq: 1, rank: 1, nickname: '사람1', tag: 1, score: 100, isMe: false },
        { seq: 2, rank: 2, nickname: '사람2', tag: 2, score: 90, isMe: false },
        { seq: 3, rank: 2, nickname: '열글자닉네임이에요', tag: 427, score: 90, isMe: false },
        { seq: 4, rank: 4, nickname: '사람4', tag: 4, score: 80, isMe: true },
      ],
      around: [
        { seq: 1, rank: 1, nickname: '사람1', tag: 1, score: 100, isMe: false },
        { seq: 4, rank: 4, nickname: '사람4', tag: 4, score: 80, isMe: true },
      ],
      me: { rank: 4, score: 80 },
    });
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
    expect(backend.callRpc).toHaveBeenCalledWith('weekly_ranking', {});
  });

  it('week를 주면 p_week로 보낸다', async () => {
    const backend = backendWith({ data: [] });
    await rankingFor(fakeAccount(backend)).fetchRanking('2000-W01');
    expect(backend.callRpc).toHaveBeenCalledWith('weekly_ranking', { p_week: '2000-W01' });
  });

  it('닉네임 없음: me.rank null·점수, around 없음', async () => {
    const backend = backendWith({
      data: [row('top', 1, 1, 100), row('me', null, null, 999, { is_me: true })],
    });
    const result = await rankingFor(fakeAccount(backend)).fetchRanking();
    expect(result).toMatchObject({ kind: 'ok', around: [], me: { rank: null, score: 999 } });
  });

  it('기록 없음·비로그인: me null', async () => {
    const backend = backendWith({ data: [row('top', 1, 1, 100)] });
    expect(await rankingFor(fakeAccount(backend)).fetchRanking()).toMatchObject({
      kind: 'ok',
      me: null,
    });
  });

  it('빈 주(0행): top 0행, 주 키는 요청한 week → 없으면 currentWeek', async () => {
    const backend = backendWith({ data: [] });
    const ranking = rankingFor(fakeAccount(backend));
    expect(await ranking.fetchRanking()).toEqual({
      kind: 'ok',
      weekKey: '2026-W46',
      top: [],
      around: [],
      me: null,
    });
    expect(await ranking.fetchRanking('2000-W01')).toMatchObject({ weekKey: '2000-W01' });
  });

  it('행이 순서 없이 와도 seq 순으로 정렬한다', async () => {
    const backend = backendWith({
      data: [row('top', 3, 2, 90), row('top', 1, 1, 100), row('top', 2, 2, 90)],
    });
    const result = await rankingFor(fakeAccount(backend)).fetchRanking();
    expect(result.kind === 'ok' && result.top.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it('계정이 아직이면 ensure로 로그인한 뒤 부른다', async () => {
    const backend = backendWith({ data: [] });
    const account = fakeAccount(backend, 'offline');
    expect((await rankingFor(account).fetchRanking()).kind).toBe('ok');
    expect(account.ensure).toHaveBeenCalled();
  });

  it('키 없음·오프라인·계정 없음(로그인 실패) → offline, 요청하지 않는다', async () => {
    const backend = backendWith({ data: [] });
    expect(await rankingFor(fakeAccount(backend, 'disabled')).fetchRanking()).toEqual({
      kind: 'offline',
    });
    expect(await rankingFor(fakeAccount(backend), false).fetchRanking()).toEqual({
      kind: 'offline',
    });
    expect(await rankingFor(fakeAccount(null, 'offline')).fetchRanking()).toEqual({
      kind: 'offline',
    });
    expect(backend.callRpc).not.toHaveBeenCalled();
  });

  it('서버 오류·네트워크·throw·응답 형식 오류 → error', async () => {
    const cases: (RpcResult | (() => Promise<RpcResult>))[] = [
      'error',
      async () => {
        throw new Error('boom');
      },
      { data: null },
      { data: { rows: [] } },
      { data: [null] },
      { data: [row('top', 1, 1, 100, { section: 'other' })] },
      { data: [row('top', 0, 1, 100)] },
      { data: [row('top', 1, null, 100)] },
      { data: [row('top', 1, 1, 100, { nickname: null })] },
      { data: [row('top', 1, 1, 100, { tag: 10000 })] },
      { data: [row('top', 1, 1, -1)] },
      { data: [row('top', 1, 1, 1.5)] },
      { data: [row('top', 1, 1, 100, { is_me: null })] },
      { data: [row('top', 1, 1, 100, { week_key: 1 })] },
      { data: [row('top', 1, 1, 100), row('top', 2, 2, 90, { week_key: '2026-W44' })] },
      { data: [row('me', 1, 1, 100), row('me', 1, 1, 100)] },
      { data: [row('me', null, 0, 100)] },
    ];
    for (const result of cases) {
      expect(await rankingFor(fakeAccount(backendWith(result))).fetchRanking()).toEqual({
        kind: 'error',
      });
    }
  });

  it(`${RANKING_TIMEOUT_MS}ms 안에 답이 없으면 error (늦게 온 답은 버린다)`, async () => {
    vi.useFakeTimers();
    const backend = backendWith(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 6000)),
    );
    const pending = rankingFor(fakeAccount(backend)).fetchRanking();
    await vi.advanceTimersByTimeAsync(RANKING_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ kind: 'error' });
    expect(RANKING_TIMEOUT_MS).toBe(5000);
  });
});
