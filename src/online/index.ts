// 온라인 기능 공개 API (PLAN2 6.3). scenes는 이 파일만 import한다.
// online은 core·view·scenes를 모른다. 어떤 함수도 게임을 막거나 throw하지 않는다
import { createAccount, type Account, type OnlineStatus } from './account';
import { createDefaultBackend, hasOnlineKeys } from './client';
import { createProfile, type MyProfile, type Profile, type SetNicknameResult } from './profile';

export type { OnlineStatus } from './account';
export type { MyProfile, SetNicknameErrorCode, SetNicknameResult } from './profile';
export {
  checkNickname,
  formatTag,
  type NicknameCheck,
  type NicknameErrorCode,
} from './nicknameRules';

let instance: { account: Account; profile: Profile } | null = null;

function online() {
  if (!instance) {
    const account = createAccount({
      hasKeys: hasOnlineKeys(),
      loadBackend: createDefaultBackend,
      isOnline: () => typeof navigator === 'undefined' || navigator.onLine,
      onOnline: (listener) => {
        if (typeof window !== 'undefined') window.addEventListener('online', listener);
      },
    });
    instance = { account, profile: createProfile(account) };
  }
  return instance;
}

export function onlineStatus(): OnlineStatus {
  return online().account.status();
}

/** 세션 확인, 없으면 익명 로그인. 절대 throw하지 않으며 기다리지 않아도 된다 */
export function ensureAccount(): Promise<void> {
  return online().account.ensure();
}

export function getMyProfile(): Promise<MyProfile | null | 'error'> {
  return online().profile.getMyProfile();
}

/** 규칙(checkNickname)으로 먼저 거른 뒤 set-nickname 함수를 부른다 */
export function setNickname(name: string): Promise<SetNicknameResult> {
  return online().profile.setNickname(name);
}
