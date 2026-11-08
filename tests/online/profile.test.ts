import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Account, OnlineStatus } from '../../src/online/account';
import {
  backendFromClient,
  type FunctionResult,
  type OnlineBackend,
} from '../../src/online/client';
import { createProfile } from '../../src/online/profile';

function fakeAccount(backend: OnlineBackend | null, status: OnlineStatus = 'ready'): Account {
  return {
    status: () => status,
    ensure: async () => {},
    userId: () => (status === 'ready' ? 'me' : null),
    backend: () => (status === 'ready' ? backend : null),
  };
}

function backendWith(result: FunctionResult | (() => Promise<FunctionResult>)) {
  return {
    getSessionUserId: vi.fn(async () => 'me'),
    signInAnonymously: vi.fn(async () => 'me'),
    onSignedOut: vi.fn(),
    fetchProfile: vi.fn(async () => null),
    callFunction: vi.fn(typeof result === 'function' ? result : async () => result),
    callRpc: vi.fn(async () => 'error' as const),
  } satisfies OnlineBackend;
}

describe('setNickname 오류 매핑', () => {
  it('규칙 위반은 서버에 보내지 않는다', async () => {
    const backend = backendWith({ status: 200, body: {} });
    const profile = createProfile(fakeAccount(backend));
    expect(await profile.setNickname('가')).toEqual({ ok: false, code: 'too-short' });
    expect(await profile.setNickname('가나다라마바사아자차카')).toEqual({
      ok: false,
      code: 'too-long',
    });
    expect(await profile.setNickname('이 안')).toEqual({ ok: false, code: 'bad-chars' });
    expect(await profile.setNickname('관리자')).toEqual({ ok: false, code: 'banned' });
    expect(backend.callFunction).not.toHaveBeenCalled();
  });

  it('성공 200 → 정규화된 이름을 보내고 서버 값을 돌려준다', async () => {
    const backend = backendWith({ status: 200, body: { nickname: '이안', tag: 427 } });
    const profile = createProfile(fakeAccount(backend));
    expect(await profile.setNickname('  이안 ')).toEqual({ ok: true, nickname: '이안', tag: 427 });
    expect(backend.callFunction).toHaveBeenCalledWith('set-nickname', { nickname: '이안' });
  });

  it.each([
    ['200 본문 이상', { status: 200, body: { nickname: '이안' } }, 'server'],
    ['400 banned', { status: 400, body: { code: 'banned' } }, 'banned'],
    ['400 too-long', { status: 400, body: { code: 'too-long' } }, 'too-long'],
    ['400 모르는 코드', { status: 400, body: { code: 'bad-request' } }, 'server'],
    ['401', { status: 401, body: { code: 'unauthorized' } }, 'unauthorized'],
    ['409', { status: 409, body: { code: 'already-set' } }, 'already-set'],
    ['500', { status: 500, body: { code: 'server' } }, 'server'],
    ['502 본문 없음', { status: 502, body: null }, 'server'],
    ['연결 실패', 'network', 'network'],
  ] as const)('%s → %s', async (_label, result, code) => {
    const profile = createProfile(fakeAccount(backendWith(result)));
    expect(await profile.setNickname('이안')).toEqual({ ok: false, code });
  });

  it('호출이 throw해도 network', async () => {
    const backend = backendWith(async () => {
      throw new Error('boom');
    });
    expect(await createProfile(fakeAccount(backend)).setNickname('이안')).toEqual({
      ok: false,
      code: 'network',
    });
  });

  it.each(['offline', 'signing-in', 'disabled'] as const)(
    '계정이 %s이면 network',
    async (status) => {
      const backend = backendWith({ status: 200, body: {} });
      expect(await createProfile(fakeAccount(backend, status)).setNickname('이안')).toEqual({
        ok: false,
        code: 'network',
      });
      expect(backend.callFunction).not.toHaveBeenCalled();
    },
  );
});

describe('getMyProfile', () => {
  it('닉네임 있음 / 행 없음 / 닉네임 비어 있음 / 조회 실패 / 계정 없음', async () => {
    const backend = backendWith('network');
    const profile = createProfile(fakeAccount(backend));

    backend.fetchProfile.mockResolvedValueOnce({ nickname: '이안', tag: 427 } as never);
    expect(await profile.getMyProfile()).toEqual({ nickname: '이안', tag: 427 });
    expect(backend.fetchProfile).toHaveBeenCalledWith('me');

    backend.fetchProfile.mockResolvedValueOnce(null);
    expect(await profile.getMyProfile()).toBeNull();

    backend.fetchProfile.mockResolvedValueOnce({ nickname: null, tag: null } as never);
    expect(await profile.getMyProfile()).toBeNull();

    backend.fetchProfile.mockRejectedValueOnce(new Error('500'));
    expect(await profile.getMyProfile()).toBe('error');

    expect(await createProfile(fakeAccount(backend, 'offline')).getMyProfile()).toBe('error');
  });
});

describe('backendFromClient: supabase-js 응답 변환', () => {
  function clientWithInvoke(result: { data: unknown; error: unknown }) {
    return { functions: { invoke: vi.fn(async () => result) } } as unknown as SupabaseClient;
  }
  const errors = { FunctionsHttpError, FunctionsFetchError };

  it('성공 → 200 + 본문', async () => {
    const backend = backendFromClient(
      clientWithInvoke({ data: { nickname: 'a', tag: 1 }, error: null }),
      errors,
    );
    expect(await backend.callFunction('set-nickname', {})).toEqual({
      status: 200,
      body: { nickname: 'a', tag: 1 },
    });
  });

  it('HTTP 오류 → 상태 코드 + JSON 본문 (본문이 JSON이 아니면 null)', async () => {
    const res = new Response(JSON.stringify({ code: 'banned' }), { status: 400 });
    const backend = backendFromClient(
      clientWithInvoke({ data: null, error: new FunctionsHttpError(res) }),
      errors,
    );
    expect(await backend.callFunction('set-nickname', {})).toEqual({
      status: 400,
      body: { code: 'banned' },
    });

    const text = new Response('nope', { status: 401 });
    const backend2 = backendFromClient(
      clientWithInvoke({ data: null, error: new FunctionsHttpError(text) }),
      errors,
    );
    expect(await backend2.callFunction('set-nickname', {})).toEqual({ status: 401, body: null });
  });

  it('연결 실패 → network, 릴레이 오류 → 502', async () => {
    const fetchErr = backendFromClient(
      clientWithInvoke({
        data: null,
        error: new FunctionsFetchError(new TypeError('fetch failed')),
      }),
      errors,
    );
    expect(await fetchErr.callFunction('set-nickname', {})).toBe('network');
    const relay = backendFromClient(
      clientWithInvoke({ data: null, error: new FunctionsRelayError({}) }),
      errors,
    );
    expect(await relay.callFunction('set-nickname', {})).toEqual({ status: 502, body: null });
  });
});
