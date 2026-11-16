// 스토리 별 랭킹 클라이언트 (PLAN2 6.9.1). 테스트 전략 API-01~07, SYNC-06~09(online 부분), REG-01.
// 가짜 계정·백엔드를 주입한다. SQL을 흉내 내지 않는다 (서버 권한·원자성은 supabase:check 원격에서 본다)
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, OnlineStatus } from '../../src/online/account';
import type { OnlineBackend, RpcResult } from '../../src/online/client';
import { createRanking } from '../../src/online/ranking';
import {
  createStoryStars,
  pickStoryStars,
  STORY_STARS_TIMEOUT_MS,
} from '../../src/online/storyStars';

type RpcImpl = (name: string, args: Record<string, unknown>) => Promise<RpcResult>;

function backendWith(impl: RpcResult | RpcImpl) {
  return {
    getSessionUserId: vi.fn(async () => 'me'),
    signInAnonymously: vi.fn(async () => 'me'),
    onSignedOut: vi.fn(),
    fetchProfile: vi.fn(async () => null),
    callFunction: vi.fn(async () => 'network' as const),
    callRpc: vi.fn<RpcImpl>(typeof impl === 'function' ? impl : async () => impl),
    insertRow: vi.fn(async () => 'error' as const),
  } satisfies OnlineBackend;
}

/** user id를 바꿀 수 있는 가짜 계정 (계정 교체 시험용) */
function fakeAccount(backend: OnlineBackend | null, initial: OnlineStatus = 'ready') {
  let status = initial;
  let uid = 'user-a';
  return {
    status: () => status,
    ensure: vi.fn(async () => {
      if (status === 'offline' && backend) status = 'ready';
    }),
    userId: () => (status === 'ready' ? uid : null),
    backend: () => (status === 'ready' ? backend : null),
    switchTo(next: string) {
      uid = next;
    },
    /** 로그아웃 (account.ts의 onSignedOut과 같은 상태) */
    signOut() {
      status = 'offline';
    },
  } satisfies Account & { switchTo(next: string): void; signOut(): void };
}

const starsFor = (account: Account, isOnline = true) =>
  createStoryStars(account, { isOnline: () => isOnline });

/** 별 합계를 돌려주는 sync 응답 */
const total = (n: unknown): RpcResult => ({ data: n });

/** DB 함수 story_ranking의 한 행 (week_key 열 없음) */
const row = (
  section: 'top' | 'around' | 'me',
  seq: number | null,
  rank: number | null,
  stars: number,
  over: Record<string, unknown> = {},
) => ({
  section,
  seq,
  rank,
  nickname: seq === null ? null : `사람${seq}`,
  tag: seq === null ? null : seq,
  total_stars: stars,
  is_me: section === 'me',
  ...over,
});

/** 끝나지 않은 Promise를 밖에서 풀 수 있게 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

afterEach(() => vi.useRealTimers());

describe('pickStoryStars · syncStoryStars 보낼 내용 (API-01·02)', () => {
  it('1~30 정수 키와 정수 1~3 값만 스테이지 번호순으로 고르고 원본은 바꾸지 않는다', () => {
    const raw: Record<string, unknown> = {
      '30': 2,
      '1': 3,
      '0': 3,
      '31': 3,
      '999': 3,
      '-1': 3,
      '1.5': 3,
      '01': 3,
      '2': 0,
      '3': 4,
      '4': 1.5,
      '5': -1,
      '6': '3',
      '7': true,
      '8': null,
      '9': 1,
    };
    const before = JSON.stringify(raw);
    expect(pickStoryStars(raw as Record<number, number>)).toEqual([
      [1, 3],
      [9, 1],
      [30, 2],
    ]);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('고른 내용만 p_stars object로 sync_story_stars에 보낸다', async () => {
    const backend = backendWith(total(6));
    const result = await starsFor(fakeAccount(backend)).syncStoryStars({
      12: 3,
      1: 2,
      999: 3,
      2: 0,
      3: 1,
    });
    expect(result).toEqual({ kind: 'ok', total: 6 });
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
    expect(backend.callRpc).toHaveBeenCalledWith('sync_story_stars', {
      p_stars: { '1': 2, '3': 1, '12': 3 },
    });
  });

  it('고른 뒤 비면 요청 없이 {ok, total 0} (서버 합계가 아니다. D-05)', async () => {
    const backend = backendWith(total(90));
    const stars = starsFor(fakeAccount(backend));
    expect(await stars.syncStoryStars({})).toEqual({ kind: 'ok', total: 0 });
    expect(await stars.syncStoryStars({ 1: 0, 999: 3 })).toEqual({ kind: 'ok', total: 0 });
    expect(await stars.syncStoryStars(null as unknown as Record<number, number>)).toEqual({
      kind: 'ok',
      total: 0,
    });
    expect(backend.callRpc).not.toHaveBeenCalled();
  });

  it('30개 모두 3별이면 30개를 보내고 서버 합계 90을 돌려준다', async () => {
    const backend = backendWith(total(90));
    const all = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i + 1, 3]));
    expect(await starsFor(fakeAccount(backend)).syncStoryStars(all)).toEqual({
      kind: 'ok',
      total: 90,
    });
    const sent = backend.callRpc.mock.calls[0]![1].p_stars as Record<string, number>;
    expect(Object.keys(sent)).toHaveLength(30);
  });
});

describe('syncStoryStars 응답·실패 (API-03·06·07)', () => {
  it('합계 0·90은 ok, -1·91·소수·문자열·null·배열·객체는 error', async () => {
    for (const n of [0, 90]) {
      expect(await starsFor(fakeAccount(backendWith(total(n)))).syncStoryStars({ 1: 1 })).toEqual({
        kind: 'ok',
        total: n,
      });
    }
    for (const bad of [-1, 91, 1.5, '3', null, [3], { total: 3 }]) {
      expect(await starsFor(fakeAccount(backendWith(total(bad)))).syncStoryStars({ 1: 1 })).toEqual(
        { kind: 'error' },
      );
    }
  });

  it('키 없음·오프라인·계정 없음 → offline, 요청하지 않는다', async () => {
    const backend = backendWith(total(3));
    expect(await starsFor(fakeAccount(backend, 'disabled')).syncStoryStars({ 1: 3 })).toEqual({
      kind: 'offline',
    });
    expect(await starsFor(fakeAccount(backend), false).syncStoryStars({ 1: 3 })).toEqual({
      kind: 'offline',
    });
    expect(await starsFor(fakeAccount(null, 'offline')).syncStoryStars({ 1: 3 })).toEqual({
      kind: 'offline',
    });
    expect(backend.callRpc).not.toHaveBeenCalled();
  });

  it('계정이 아직이면 ensure로 로그인한 뒤 보낸다', async () => {
    const backend = backendWith(total(3));
    const account = fakeAccount(backend, 'offline');
    expect(await starsFor(account).syncStoryStars({ 1: 3 })).toEqual({ kind: 'ok', total: 3 });
    expect(account.ensure).toHaveBeenCalled();
  });

  it('서버 오류·throw → error (reject하지 않는다)', async () => {
    const cases: (RpcResult | RpcImpl)[] = [
      'error',
      async () => {
        throw new Error('boom');
      },
    ];
    for (const c of cases) {
      await expect(starsFor(fakeAccount(backendWith(c))).syncStoryStars({ 1: 3 })).resolves.toEqual(
        { kind: 'error' },
      );
    }
  });

  it('ensure가 끝나지 않아도 5초 뒤 error', async () => {
    vi.useFakeTimers();
    const backend = backendWith(total(3));
    const account = fakeAccount(backend, 'offline');
    account.ensure.mockImplementation(() => new Promise(() => {}));
    const pending = starsFor(account).syncStoryStars({ 1: 3 });
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS);
    expect(await pending).toEqual({ kind: 'error' });
    expect(STORY_STARS_TIMEOUT_MS).toBe(5000);
  });

  it(`${STORY_STARS_TIMEOUT_MS}ms 안에 답이 없으면 error, 늦게 온 성공은 기억하지 않는다`, async () => {
    vi.useFakeTimers();
    let calls = 0;
    const backend = backendWith(() => {
      calls += 1;
      return calls === 1
        ? new Promise((resolve) => setTimeout(() => resolve(total(3)), 6000))
        : Promise.resolve(total(3));
    });
    const stars = starsFor(fakeAccount(backend));
    const pending = stars.syncStoryStars({ 1: 3 });
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await flush();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ kind: 'error' });
    // 늦은 성공(6초)이 도착한 뒤에도 같은 내용을 다시 보낸다
    await vi.advanceTimersByTimeAsync(2000);
    expect(await stars.syncStoryStars({ 1: 3 })).toEqual({ kind: 'ok', total: 3 });
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
  });
});

describe('syncStoryStars 성공 기억·계정·직렬화 (SYNC-06~09)', () => {
  it('SYNC-07: 같은 계정·같은 내용의 성공 뒤에는 다시 보내지 않는다 (키 순서만 달라도 같다)', async () => {
    const backend = backendWith(total(4));
    const stars = starsFor(fakeAccount(backend));
    expect(await stars.syncStoryStars({ 1: 3, 2: 1 })).toEqual({ kind: 'ok', total: 4 });
    expect(await stars.syncStoryStars({ 2: 1, 1: 3 })).toEqual({ kind: 'ok', total: 4 });
    // 버려지는 항목만 다르면 보내는 내용이 같다
    expect(await stars.syncStoryStars({ 1: 3, 2: 1, 999: 3, 5: 0 })).toEqual({
      kind: 'ok',
      total: 4,
    });
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
  });

  it('SYNC-07: 내용이 바뀌면 전체를 다시 보낸다', async () => {
    const backend = backendWith(total(5));
    const stars = starsFor(fakeAccount(backend));
    await stars.syncStoryStars({ 1: 3, 2: 1 });
    await stars.syncStoryStars({ 1: 3, 2: 2 });
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
    expect(backend.callRpc).toHaveBeenLastCalledWith('sync_story_stars', {
      p_stars: { '1': 3, '2': 2 },
    });
  });

  it('SYNC-06: 실패(응답 유실)는 기억하지 않아 같은 전체 내용을 다시 보낸다', async () => {
    let calls = 0;
    const backend = backendWith(async () => (++calls === 1 ? 'error' : total(4)));
    const stars = starsFor(fakeAccount(backend));
    expect(await stars.syncStoryStars({ 1: 3, 2: 1 })).toEqual({ kind: 'error' });
    expect(await stars.syncStoryStars({ 1: 3, 2: 1 })).toEqual({ kind: 'ok', total: 4 });
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
    expect(backend.callRpc.mock.calls[0]).toEqual(backend.callRpc.mock.calls[1]);
    // 형식 오류 응답도 기억하지 않는다
    const bad = backendWith(total(91));
    const stars2 = starsFor(fakeAccount(bad));
    await stars2.syncStoryStars({ 1: 3 });
    await stars2.syncStoryStars({ 1: 3 });
    expect(bad.callRpc).toHaveBeenCalledTimes(2);
  });

  it('SYNC-07: 기억은 메모리에만 있다 (새로 만들면 다시 보낸다)', async () => {
    const backend = backendWith(total(3));
    await starsFor(fakeAccount(backend)).syncStoryStars({ 1: 3 });
    await starsFor(fakeAccount(backend)).syncStoryStars({ 1: 3 });
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
  });

  it('SYNC-08: 계정이 바뀌면 같은 별도 다시 보내고, 돌아오면 원래 계정의 기억을 쓴다', async () => {
    const backend = backendWith(total(3));
    const account = fakeAccount(backend);
    const stars = starsFor(account);
    await stars.syncStoryStars({ 1: 3 });
    account.switchTo('user-b');
    await stars.syncStoryStars({ 1: 3 });
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
    await stars.syncStoryStars({ 1: 3 });
    account.switchTo('user-a');
    await stars.syncStoryStars({ 1: 3 });
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
  });

  it('SYNC-08: A로 보내는 중에 B로 바뀌어도 A의 성공은 B의 기억이 되지 않는다', async () => {
    const gate = deferred<RpcResult>();
    let calls = 0;
    const backend = backendWith(() => (++calls === 1 ? gate.promise : Promise.resolve(total(3))));
    const account = fakeAccount(backend);
    const stars = starsFor(account);
    const first = stars.syncStoryStars({ 1: 3 });
    await flush();
    account.switchTo('user-b');
    gate.resolve(total(3));
    expect(await first).toEqual({ kind: 'ok', total: 3 });
    await stars.syncStoryStars({ 1: 3 });
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
  });

  it('SYNC-09: 호출은 한 줄로 선다. 앞 호출이 끝나기 전에는 다음 요청을 보내지 않고, 마지막에 최신 내용을 보낸다', async () => {
    const gates: ReturnType<typeof deferred<RpcResult>>[] = [];
    const backend = backendWith(() => {
      const g = deferred<RpcResult>();
      gates.push(g);
      return g.promise;
    });
    const stars = starsFor(fakeAccount(backend));
    const boot = stars.syncStoryStars({ 1: 1 });
    const clear = stars.syncStoryStars({ 1: 3 });
    await flush();
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
    gates[0]!.resolve(total(1));
    expect(await boot).toEqual({ kind: 'ok', total: 1 });
    await flush();
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
    expect(backend.callRpc).toHaveBeenLastCalledWith('sync_story_stars', { p_stars: { '1': 3 } });
    gates[1]!.resolve(total(3));
    expect(await clear).toEqual({ kind: 'ok', total: 3 });
  });

  it('SYNC-09: 탭의 "동기화 → 조회"는 진행 중인 부팅 동기화와 자기 동기화가 끝난 뒤 조회한다', async () => {
    const order: string[] = [];
    const bootGate = deferred<RpcResult>();
    let syncs = 0;
    const backend = backendWith(async (name, args) => {
      if (name === 'sync_story_stars') {
        syncs += 1;
        order.push(`sync ${JSON.stringify(args.p_stars)}`);
        return syncs === 1 ? bootGate.promise : total(3);
      }
      order.push(name);
      return { data: [row('me', 1, 1, 3, { nickname: '나', tag: 1 })] };
    });
    const stars = starsFor(fakeAccount(backend));
    void stars.syncStoryStars({ 1: 1 });
    const tab = stars.syncStoryStars({ 1: 3 }).then(() => stars.fetchStoryRanking());
    await flush();
    expect(order).toEqual(['sync {"1":1}']);
    bootGate.resolve(total(1));
    expect(await tab).toMatchObject({ kind: 'ok', me: { rank: 1, score: 3 } });
    expect(order).toEqual(['sync {"1":1}', 'sync {"1":3}', 'story_ranking']);
  });

  it('SYNC-09: 앞 호출이 시간 초과로 끝나도 줄이 막히지 않는다 (뒤 호출은 자기 마감 안에서 보낸다)', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const backend = backendWith(() =>
      ++calls === 1 ? new Promise<RpcResult>(() => {}) : Promise.resolve(total(3)),
    );
    const stars = starsFor(fakeAccount(backend));
    const first = stars.syncStoryStars({ 1: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    const second = stars.syncStoryStars({ 1: 3 });
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS - 1000);
    expect(await first).toEqual({ kind: 'error' });
    expect(await second).toEqual({ kind: 'ok', total: 3 });
  });
});

describe('fetchStoryRanking (API-04~07)', () => {
  it('정상 응답 → top·around·me 매핑, 인자 없이 story_ranking 한 번 (week 행 없음)', async () => {
    const backend = backendWith({
      data: [
        row('top', 1, 1, 90),
        row('top', 2, 1, 90, { nickname: '열글자닉네임이에요', tag: 427 }),
        row('top', 3, 3, 57, { is_me: true }),
        row('around', 1, 1, 90),
        row('around', 3, 3, 57, { is_me: true }),
        row('me', 3, 3, 57),
      ],
    });
    expect(await starsFor(fakeAccount(backend)).fetchStoryRanking()).toEqual({
      kind: 'ok',
      top: [
        { seq: 1, rank: 1, nickname: '사람1', tag: 1, score: 90, isMe: false },
        { seq: 2, rank: 1, nickname: '열글자닉네임이에요', tag: 427, score: 90, isMe: false },
        { seq: 3, rank: 3, nickname: '사람3', tag: 3, score: 57, isMe: true },
      ],
      around: [
        { seq: 1, rank: 1, nickname: '사람1', tag: 1, score: 90, isMe: false },
        { seq: 3, rank: 3, nickname: '사람3', tag: 3, score: 57, isMe: true },
      ],
      me: { rank: 3, score: 57 },
    });
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
    expect(backend.callRpc).toHaveBeenCalledWith('story_ranking', {});
  });

  it('빈 배열(공개 기록 없음·anon) → ok, 빈 목록·me null', async () => {
    expect(await starsFor(fakeAccount(backendWith({ data: [] }))).fetchStoryRanking()).toEqual({
      kind: 'ok',
      top: [],
      around: [],
      me: null,
    });
  });

  it('닉네임 없음: me.rank null·합계, around 없음', async () => {
    const backend = backendWith({ data: [row('top', 1, 1, 90), row('me', null, null, 90)] });
    expect(await starsFor(fakeAccount(backend)).fetchStoryRanking()).toMatchObject({
      kind: 'ok',
      around: [],
      me: { rank: null, score: 90 },
    });
  });

  it('행이 순서 없이 와도 seq 순으로 정렬한다', async () => {
    const backend = backendWith({
      data: [row('top', 3, 2, 5), row('top', 1, 1, 6), row('top', 2, 2, 5)],
    });
    const result = await starsFor(fakeAccount(backend)).fetchStoryRanking();
    expect(result.kind === 'ok' && result.top.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it('API-05: 형식이 어긋나면 부분 목록 없이 error', async () => {
    const cases: RpcResult[] = [
      'error',
      { data: null },
      { data: { rows: [] } },
      { data: [null] },
      { data: [row('top', 1, 1, 6), 'x'] },
      // week 메타 행이 섞였다
      { data: [{ ...row('top', 1, 1, 6), section: 'week' }] },
      { data: [row('top', 1, 1, 6, { section: 'other' })] },
      // 합계
      { data: [row('top', 1, 1, -1)] },
      { data: [row('top', 1, 1, 91)] },
      { data: [row('top', 1, 1, 1.5)] },
      { data: [row('top', 1, 1, 6, { total_stars: '6' })] },
      { data: [row('top', 1, 1, 6, { total_stars: null })] },
      { data: [row('me', null, null, 91)] },
      // 목록 행
      { data: [row('top', 0, 1, 6)] },
      { data: [row('top', 1, null, 6)] },
      { data: [row('top', 1, 0, 6)] },
      { data: [row('top', 2, 3, 6)] },
      { data: [row('top', 51, 51, 6)] },
      { data: [row('top', 1, 1, 6, { nickname: null })] },
      { data: [row('top', 1, 1, 6, { tag: 10000 })] },
      { data: [row('top', 1, 1, 6, { tag: null })] },
      { data: [row('top', 1, 1, 6, { is_me: null })] },
      // me
      { data: [row('me', 1, 1, 6), row('me', 1, 1, 6)] },
      { data: [row('me', null, 0, 6)] },
      { data: [row('me', 1, null, 6)] },
      { data: [row('me', null, 1, 6)] },
      { data: [row('me', 1, 1, 6, { is_me: false })] },
      // R4: me도 rank <= seq
      { data: [row('me', 1, 2, 3)] },
    ];
    for (const result of cases) {
      expect(await starsFor(fakeAccount(backendWith(result))).fetchStoryRanking()).toEqual({
        kind: 'error',
      });
    }
  });

  it('API-06: 키 없음·오프라인·계정 없음 → offline, 서버 오류·throw → error', async () => {
    const backend = backendWith({ data: [] });
    expect(await starsFor(fakeAccount(backend, 'disabled')).fetchStoryRanking()).toEqual({
      kind: 'offline',
    });
    expect(await starsFor(fakeAccount(backend), false).fetchStoryRanking()).toEqual({
      kind: 'offline',
    });
    expect(await starsFor(fakeAccount(null, 'offline')).fetchStoryRanking()).toEqual({
      kind: 'offline',
    });
    expect(backend.callRpc).not.toHaveBeenCalled();
    const thrower = backendWith(async () => {
      throw new Error('boom');
    });
    await expect(starsFor(fakeAccount(thrower)).fetchStoryRanking()).resolves.toEqual({
      kind: 'error',
    });
  });

  it(`API-07: ${STORY_STARS_TIMEOUT_MS}ms 안에 답이 없으면 error`, async () => {
    vi.useFakeTimers();
    const backend = backendWith(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 6000)),
    );
    const pending = starsFor(fakeAccount(backend)).fetchStoryRanking();
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await flush();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ kind: 'error' });
  });
});

describe('Codex 리뷰 R1~R4 재검증', () => {
  it('R1: 앞 요청과 자기 RPC가 모두 멈춰도 각 호출은 호출 시점부터 5초에 error, 대기 중 만료한 요청은 보내지 않는다', async () => {
    vi.useFakeTimers();
    const backend = backendWith(() => new Promise<RpcResult>(() => {}));
    const stars = starsFor(fakeAccount(backend));
    const settled: number[] = [];
    const calls = [{ 1: 1 }, { 1: 2 }, { 1: 3 }].map((b, i) =>
      stars.syncStoryStars(b).then((r) => {
        settled.push(i);
        return r;
      }),
    );
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS - 1);
    expect(settled).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await Promise.all(calls)).toEqual([
      { kind: 'error' },
      { kind: 'error' },
      { kind: 'error' },
    ]);
    // 첫 요청만 보냈다. 둘째·셋째는 큐에서 기다리다 만료되어 보내지 않는다
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
  });

  it('R1: 늦게 들어온 호출도 자기 호출 시점부터 5초가 상한이다', async () => {
    vi.useFakeTimers();
    const backend = backendWith(() => new Promise<RpcResult>(() => {}));
    const stars = starsFor(fakeAccount(backend));
    void stars.syncStoryStars({ 1: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    let done = false;
    const second = stars.syncStoryStars({ 1: 3 }).then((r) => ((done = true), r));
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toEqual({ kind: 'error' });
    // 첫 요청 마감(5초)에 큐가 풀려 둘째는 남은 1초 안에 보냈다
    expect(backend.callRpc).toHaveBeenCalledTimes(2);
  });

  it('R1: 대기 중 만료한 요청은 큐가 풀려도 보내지 않고 기억도 건드리지 않으며, 뒤이은 정상 재시도는 성공한다', async () => {
    vi.useFakeTimers();
    const gate = deferred<RpcResult>();
    let calls = 0;
    const backend = backendWith(() => (++calls === 1 ? gate.promise : Promise.resolve(total(4))));
    const stars = starsFor(fakeAccount(backend));
    const first = stars.syncStoryStars({ 1: 1 });
    const waiting = stars.syncStoryStars({ 1: 3, 2: 1 });
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS);
    expect(await first).toEqual({ kind: 'error' });
    expect(await waiting).toEqual({ kind: 'error' });
    gate.resolve(total(1)); // 첫 요청의 늦은 성공
    await vi.advanceTimersByTimeAsync(10);
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
    // 둘 다 기억되지 않았다: 같은 내용을 다시 보낸다
    expect(await stars.syncStoryStars({ 1: 3, 2: 1 })).toEqual({ kind: 'ok', total: 4 });
    expect(await stars.syncStoryStars({ 1: 1 })).toEqual({ kind: 'ok', total: 4 });
    expect(backend.callRpc).toHaveBeenCalledTimes(3);
    // 정상 성공은 기억한다 (순차 전송·성공 기억 유지)
    expect(await stars.syncStoryStars({ 1: 1 })).toEqual({ kind: 'ok', total: 4 });
    expect(backend.callRpc).toHaveBeenCalledTimes(3);
  });

  /** ensure가 gate에서 멈추는 계정 (실제 Account처럼 진행 중 ensure를 공유한다) */
  function slowEnsureAccount(backend: OnlineBackend, gate: Promise<void>) {
    const account = fakeAccount(backend, 'offline');
    let status: OnlineStatus = 'offline';
    let uid = 'user-a';
    const shared = gate.then(() => {
      status = 'ready';
    });
    return Object.assign(account, {
      status: () => status,
      ensure: vi.fn(() => shared),
      userId: () => (status === 'ready' ? uid : null),
      backend: () => (status === 'ready' ? backend : null),
      switchTo: (next: string) => {
        uid = next;
      },
    });
  }

  it('R2: 계정 준비 중 시간 초과된 작업은 ensure가 풀린 뒤에도 RPC를 시작하지 않는다 (동시 RPC 1개)', async () => {
    vi.useFakeTimers();
    const gate = deferred<void>();
    let inflight = 0;
    let maxInflight = 0;
    const backend = backendWith(async (name) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 100));
      inflight -= 1;
      return name === 'sync_story_stars' ? total(3) : { data: [] };
    });
    const account = slowEnsureAccount(backend, gate.promise);
    const stars = starsFor(account);
    const first = stars.syncStoryStars({ 1: 1 });
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS);
    expect(await first).toEqual({ kind: 'error' });
    const second = stars.syncStoryStars({ 1: 3 });
    await vi.advanceTimersByTimeAsync(500);
    gate.resolve();
    await vi.advanceTimersByTimeAsync(200);
    expect(await second).toEqual({ kind: 'ok', total: 3 });
    expect(backend.callRpc.mock.calls).toEqual([['sync_story_stars', { p_stars: { '1': 3 } }]]);
    expect(maxInflight).toBe(1);
  });

  it('R2: 그 사이 계정이 A→B로 바뀌고 후속 sync·조회가 시작돼도 만료 작업의 RPC는 0회', async () => {
    vi.useFakeTimers();
    const gate = deferred<void>();
    const backend = backendWith(async (name) =>
      name === 'sync_story_stars' ? total(3) : { data: [] },
    );
    const account = slowEnsureAccount(backend, gate.promise);
    const stars = starsFor(account);
    const first = stars.syncStoryStars({ 1: 1 });
    await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS);
    expect(await first).toEqual({ kind: 'error' });
    account.switchTo('user-b');
    const tab = stars.syncStoryStars({ 1: 3 }).then(() => stars.fetchStoryRanking());
    await vi.advanceTimersByTimeAsync(100);
    gate.resolve();
    expect(await tab).toMatchObject({ kind: 'ok' });
    expect(backend.callRpc.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['sync_story_stars', { p_stars: { '1': 3 } }],
      ['story_ranking', {}],
    ]);
  });

  it('R3: 조회 중 계정이 A→B로 바뀌면 A의 me를 쓰지 않고 error', async () => {
    const gate = deferred<RpcResult>();
    const backend = backendWith(() => gate.promise);
    const account = fakeAccount(backend);
    const pending = starsFor(account).fetchStoryRanking();
    await flush();
    account.switchTo('user-b');
    gate.resolve({ data: [row('me', 8, 8, 57)] });
    expect(await pending).toEqual({ kind: 'error' });
  });

  it('R3: 조회 중 로그아웃되어 그대로면 error', async () => {
    const gate = deferred<RpcResult>();
    const backend = backendWith(() => gate.promise);
    const account = fakeAccount(backend);
    const pending = starsFor(account).fetchStoryRanking();
    await flush();
    account.signOut();
    gate.resolve({ data: [row('me', 8, 8, 57)] });
    expect(await pending).toEqual({ kind: 'error' });
  });

  it('R3: 계정이 그대로면 정상 조회', async () => {
    const gate = deferred<RpcResult>();
    const backend = backendWith(() => gate.promise);
    const pending = starsFor(fakeAccount(backend)).fetchStoryRanking();
    await flush();
    gate.resolve({ data: [row('me', 8, 8, 57)] });
    expect(await pending).toMatchObject({ kind: 'ok', me: { rank: 8, score: 57 } });
  });

  it('G1: 끝나지 않는 sync 뒤의 빈 내용은 온라인·오프라인 모두 5초 안에 ok 0, RPC·기억 무변경', async () => {
    vi.useFakeTimers();
    for (const isOnline of [true, false]) {
      for (const empty of [{}, { 1: 0, 999: 3 }] as Record<number, number>[]) {
        let online = true;
        let calls = 0;
        const backend = backendWith(() =>
          ++calls === 1 ? new Promise<RpcResult>(() => {}) : Promise.resolve(total(3)),
        );
        const stars = createStoryStars(fakeAccount(backend), { isOnline: () => online });
        void stars.syncStoryStars({ 1: 1 });
        await flush();
        expect(backend.callRpc).toHaveBeenCalledTimes(1); // 앞 sync는 RPC를 보내고 멈춰 있다
        online = isOnline;
        let settled = false;
        const pending = stars.syncStoryStars(empty).then((r) => ((settled = true), r));
        await vi.advanceTimersByTimeAsync(STORY_STARS_TIMEOUT_MS - 1);
        expect(settled).toBe(false); // 앞 호출을 기다린다 (순서 보존)
        await vi.advanceTimersByTimeAsync(1);
        expect(await pending).toEqual({ kind: 'ok', total: 0 });
        await vi.advanceTimersByTimeAsync(60_000);
        expect(backend.callRpc).toHaveBeenCalledTimes(1);
        // 기억 무변경: 온라인으로 돌아와 {1:1}을 보내면 다시 보낸다 (빈 내용이 성공으로 기억되지 않았다)
        online = true;
        expect(await stars.syncStoryStars({ 1: 1 })).toEqual({ kind: 'ok', total: 3 });
        expect(backend.callRpc).toHaveBeenCalledTimes(2);
      }
    }
  });

  it('G1: 앞 호출이 빨리 끝나면 빈 내용도 그 뒤 바로 ok 0 (RPC 없음)', async () => {
    const gate = deferred<RpcResult>();
    const backend = backendWith(() => gate.promise);
    const stars = starsFor(fakeAccount(backend));
    const first = stars.syncStoryStars({ 1: 1 });
    let settled = false;
    const empty = stars.syncStoryStars({}).then((r) => ((settled = true), r));
    await flush();
    expect(settled).toBe(false);
    gate.resolve(total(1));
    expect(await first).toEqual({ kind: 'ok', total: 1 });
    expect(await empty).toEqual({ kind: 'ok', total: 0 });
    expect(backend.callRpc).toHaveBeenCalledTimes(1);
  });

  it('R4: me는 rank > seq 거부, rank = seq·rank < seq(공동 순위)·둘 다 null 허용, 한쪽만 null 거부', async () => {
    const parse = async (data: unknown[]) =>
      starsFor(fakeAccount(backendWith({ data }))).fetchStoryRanking();
    expect(await parse([row('me', 1, 2, 3)])).toEqual({ kind: 'error' });
    expect(await parse([row('me', 3, 3, 3)])).toMatchObject({ me: { rank: 3, score: 3 } });
    expect(await parse([row('me', 3, 2, 3)])).toMatchObject({ me: { rank: 2, score: 3 } });
    expect(await parse([row('me', null, null, 3)])).toMatchObject({ me: { rank: null } });
    expect(await parse([row('me', 1, null, 3)])).toEqual({ kind: 'error' });
    expect(await parse([row('me', null, 1, 3)])).toEqual({ kind: 'error' });
  });
});

describe('주간 랭킹과의 경계 (REG-01)', () => {
  it('weekly parser는 여전히 week 메타 행을 요구하고, story parser는 week 없이 받는다', async () => {
    const storyRows = [row('top', 1, 1, 6)];
    const backend = backendWith({ data: storyRows });
    const account = fakeAccount(backend);
    expect(await createRanking(account, { isOnline: () => true }).fetchRanking()).toEqual({
      kind: 'error',
    });
    expect(await starsFor(account).fetchStoryRanking()).toMatchObject({ kind: 'ok' });
    expect(backend.callRpc.mock.calls.map((c) => c[0])).toEqual([
      'weekly_ranking',
      'story_ranking',
    ]);
  });
});

describe('키 없는 빌드 (.env.local 없음)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('스토리 별 함수도 throw하지 않는다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    const online = await import('../../src/online');
    expect(await online.syncStoryStars({ 1: 3 })).toEqual({ kind: 'offline' });
    expect(await online.syncStoryStars({})).toEqual({ kind: 'ok', total: 0 });
    expect(await online.fetchStoryRanking()).toEqual({ kind: 'offline' });
  });
});
