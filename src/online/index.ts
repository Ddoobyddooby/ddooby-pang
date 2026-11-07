// 온라인 기능 공개 API (PLAN2 6.3·6.4). scenes는 이 파일만 import한다.
// online은 core·view·scenes를 모른다. 어떤 함수도 게임을 막거나 throw하지 않는다
import { createAccount, type Account, type OnlineStatus } from './account';
import { createDefaultBackend, hasOnlineKeys } from './client';
import { createProfile, type MyProfile, type Profile, type SetNicknameResult } from './profile';
import {
  createRuns,
  type Runs,
  type StartedRun,
  type SubmitOutcome,
  type SubmitPayload,
} from './runs';
// 자동 생성 상수 (import 없음). online이 게임 계층(core)에 기대는 것은 아니다
import { CORE_VERSION } from '../replay/coreVersion';

export type { OnlineStatus } from './account';
export type { MyProfile, SetNicknameErrorCode, SetNicknameResult } from './profile';
export type { RunMove, StartedRun, SubmitOutcome, SubmitPayload } from './runs';
export {
  checkNickname,
  formatTag,
  type NicknameCheck,
  type NicknameErrorCode,
} from './nicknameRules';

let instance: { account: Account; profile: Profile; runs: Runs } | null = null;

function online() {
  if (!instance) {
    const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;
    const account = createAccount({
      hasKeys: hasOnlineKeys(),
      loadBackend: createDefaultBackend,
      isOnline,
      onOnline: (listener) => {
        if (typeof window !== 'undefined') window.addEventListener('online', listener);
      },
    });
    instance = {
      account,
      profile: createProfile(account),
      runs: createRuns(account, { version: CORE_VERSION, isOnline }),
    };
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

/** 경쟁 모드 run 발급 (최대 2.5초). null이면 랭킹 없이 로컬 seed로 시작한다. 절대 throw하지 않는다 */
export function startRun(): Promise<StartedRun | null> {
  return online().runs.startRun();
}

/** 경쟁 모드 점수 제출 (최대 10초). 절대 throw하지 않는다 */
export function submitScore(runId: string, payload: SubmitPayload): Promise<SubmitOutcome> {
  return online().runs.submitScore(runId, payload);
}
