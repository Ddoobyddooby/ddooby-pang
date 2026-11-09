import { describe, expect, it, vi } from 'vitest';
import { createAccount, type AccountDeps } from '../../src/online/account';
import type { OnlineBackend } from '../../src/online/client';

/** 가짜 Supabase 백엔드. 세션·로그인 결과를 시험마다 바꾼다 */
function fakeBackend(opts: { session?: string | null; signIn?: () => Promise<string> } = {}) {
  let signedOut: (() => void) | null = null;
  const backend = {
    getSessionUserId: vi.fn(async () => opts.session ?? null),
    signInAnonymously: vi.fn(opts.signIn ?? (async () => 'new-user')),
    onSignedOut: vi.fn((listener: () => void) => void (signedOut = listener)),
    fetchProfile: vi.fn(async () => null),
    callFunction: vi.fn(async () => 'network' as const),
    callRpc: vi.fn(async () => 'error' as const),
    insertRow: vi.fn(async () => 'error' as const),
  } satisfies OnlineBackend;
  return { backend, signOut: () => signedOut?.() };
}

function deps(backend: OnlineBackend | null, online = true) {
  let onlineListener: (() => void) | null = null;
  const d = {
    hasKeys: backend !== null,
    loadBackend: vi.fn(async () => backend),
    isOnline: vi.fn(() => online),
    onOnline: vi.fn((listener: () => void) => void (onlineListener = listener)),
  } satisfies AccountDeps;
  return {
    deps: d,
    setOnline: (v: boolean) => (online = v),
    fireOnline: () => onlineListener?.(),
  };
}

describe('ensureAccount 상태 전이', () => {
  it('키 없음 → disabled, 백엔드를 불러오지 않는다', async () => {
    const { deps: d } = deps(null);
    const account = createAccount(d);
    expect(account.status()).toBe('disabled');
    await account.ensure();
    expect(account.status()).toBe('disabled');
    expect(d.loadBackend).not.toHaveBeenCalled();
    expect(account.backend()).toBeNull();
  });

  it('세션 있음 → 로그인 없이 ready', async () => {
    const { backend } = fakeBackend({ session: 'saved-user' });
    const account = createAccount(deps(backend).deps);
    expect(account.status()).toBe('offline');
    const pending = account.ensure();
    expect(account.status()).toBe('signing-in');
    await pending;
    expect(account.status()).toBe('ready');
    expect(account.userId()).toBe('saved-user');
    expect(backend.signInAnonymously).not.toHaveBeenCalled();
  });

  it('온라인 신규 → 익명 로그인 후 ready', async () => {
    const { backend } = fakeBackend();
    const account = createAccount(deps(backend).deps);
    await account.ensure();
    expect(backend.signInAnonymously).toHaveBeenCalledOnce();
    expect(account.status()).toBe('ready');
    expect(account.userId()).toBe('new-user');
    expect(account.backend()).toBe(backend);
  });

  it('오프라인 신규 → offline, online 이벤트에 다시 시도해 ready', async () => {
    const { backend } = fakeBackend();
    const env = deps(backend, false);
    const account = createAccount(env.deps);
    await account.ensure();
    expect(account.status()).toBe('offline');
    expect(backend.signInAnonymously).not.toHaveBeenCalled();
    expect(account.userId()).toBeNull();

    env.setOnline(true);
    env.fireOnline();
    await vi.waitFor(() => expect(account.status()).toBe('ready'));
    expect(backend.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('로그인 실패 → throw 없이 offline, online 이벤트로 재시도해 ready', async () => {
    let fail = true;
    const { backend } = fakeBackend({
      signIn: async () => {
        if (fail) throw new Error('rate limit');
        return 'retry-user';
      },
    });
    const env = deps(backend);
    const account = createAccount(env.deps);
    await expect(account.ensure()).resolves.toBeUndefined();
    expect(account.status()).toBe('offline');
    expect(env.deps.onOnline).toHaveBeenCalledOnce();

    fail = false;
    env.fireOnline();
    await vi.waitFor(() => expect(account.status()).toBe('ready'));
    expect(account.userId()).toBe('retry-user');
  });

  it('실패 뒤 다음 ensureAccount 호출로도 다시 시도한다 (online 리스너는 한 번만 단다)', async () => {
    let fail = true;
    const { backend } = fakeBackend({
      signIn: async () => {
        if (fail) throw new Error('500');
        return 'u';
      },
    });
    const env = deps(backend);
    const account = createAccount(env.deps);
    await account.ensure();
    await account.ensure();
    expect(account.status()).toBe('offline');
    fail = false;
    await account.ensure();
    expect(account.status()).toBe('ready');
    expect(env.deps.onOnline).toHaveBeenCalledOnce();
    expect(env.deps.loadBackend).toHaveBeenCalledOnce();
  });

  it('세션 확인·백엔드 불러오기 실패도 throw하지 않는다', async () => {
    const { backend } = fakeBackend();
    backend.getSessionUserId.mockRejectedValueOnce(new Error('storage'));
    const env = deps(backend);
    const account = createAccount(env.deps);
    await account.ensure();
    expect(account.status()).toBe('offline');

    env.deps.loadBackend.mockRejectedValueOnce(new Error('chunk'));
    const account2 = createAccount(env.deps);
    await expect(account2.ensure()).resolves.toBeUndefined();
    expect(account2.status()).toBe('offline');
  });

  it('동시에 여러 번 불러도 로그인은 한 번', async () => {
    const { backend } = fakeBackend();
    const account = createAccount(deps(backend).deps);
    await Promise.all([account.ensure(), account.ensure(), account.ensure()]);
    expect(backend.signInAnonymously).toHaveBeenCalledOnce();
    await account.ensure();
    expect(backend.getSessionUserId).toHaveBeenCalledOnce();
  });

  it('세션이 사라지면 offline으로 돌아가고 다음 호출에서 다시 만든다', async () => {
    const fake = fakeBackend({ session: 'u1' });
    const account = createAccount(deps(fake.backend).deps);
    await account.ensure();
    expect(account.status()).toBe('ready');
    fake.signOut();
    expect(account.status()).toBe('offline');
    expect(account.userId()).toBeNull();
    expect(account.backend()).toBeNull();
    fake.backend.getSessionUserId.mockResolvedValueOnce(null);
    await account.ensure();
    expect(account.status()).toBe('ready');
    expect(account.userId()).toBe('new-user');
  });
});
