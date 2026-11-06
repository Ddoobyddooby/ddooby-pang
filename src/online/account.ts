// 익명 계정 (SPEC v0.2 5.1, PLAN2 6.3). 게임을 막지 않는다: 실패·오프라인이면 조용히 넘어가고
// 브라우저 `online` 이벤트나 다음 ensureAccount() 호출 때 다시 시도한다
import type { OnlineBackend } from './client';

/**
 * - disabled: 키 없는 빌드. 온라인 기능 꺼짐
 * - offline: 키는 있지만 계정(세션)이 없다. 오프라인이거나 로그인 실패
 * - signing-in: 세션 확인·익명 로그인 중
 * - ready: 계정 있음
 */
export type OnlineStatus = 'disabled' | 'offline' | 'signing-in' | 'ready';

export interface AccountDeps {
  hasKeys: boolean;
  loadBackend(): Promise<OnlineBackend | null>;
  isOnline(): boolean;
  /** 네트워크가 다시 연결되면 listener를 부른다 (브라우저 `online` 이벤트) */
  onOnline(listener: () => void): void;
}

export interface Account {
  status(): OnlineStatus;
  /** 절대 throw하지 않는다. 기다리지 않아도 된다 */
  ensure(): Promise<void>;
  userId(): string | null;
  /** ready일 때만 백엔드를 준다 */
  backend(): OnlineBackend | null;
}

export function createAccount(deps: AccountDeps): Account {
  let status: OnlineStatus = deps.hasKeys ? 'offline' : 'disabled';
  let userId: string | null = null;
  let backend: OnlineBackend | null = null;
  let inflight: Promise<void> | null = null;
  let retryArmed = false;

  const armRetry = () => {
    if (retryArmed) return;
    retryArmed = true;
    deps.onOnline(() => void ensure());
  };

  const loadBackend = async (): Promise<OnlineBackend | null> => {
    if (backend) return backend;
    const loaded = await deps.loadBackend();
    if (loaded) {
      loaded.onSignedOut(() => {
        userId = null;
        status = 'offline';
      });
      backend = loaded;
    }
    return loaded;
  };

  const run = async () => {
    status = 'signing-in';
    try {
      const b = await loadBackend();
      if (!b) {
        status = 'disabled';
        return;
      }
      let id = await b.getSessionUserId();
      if (!id) {
        if (!deps.isOnline()) {
          status = 'offline';
          armRetry();
          return;
        }
        id = await b.signInAnonymously();
      }
      userId = id;
      status = 'ready';
    } catch {
      userId = null;
      status = 'offline';
      armRetry();
    }
  };

  const ensure = (): Promise<void> => {
    if (status === 'disabled' || status === 'ready') return Promise.resolve();
    if (!inflight) inflight = run().finally(() => (inflight = null));
    return inflight;
  };

  return {
    status: () => status,
    ensure,
    userId: () => (status === 'ready' ? userId : null),
    backend: () => (status === 'ready' ? backend : null),
  };
}
