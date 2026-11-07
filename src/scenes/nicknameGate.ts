// 결과 화면에서 닉네임 입력 창을 띄울지 정한다 (V2-W3-02, PLAN2 6.3). 순수 함수라 테스트한다.
// 점수 제출이 성공(kind 'ok')한 뒤에만 연다 (V2-W3-03, PLAN2 6.4).

import type { MyProfile, OnlineStatus, SetNicknameResult } from '../online';
import type { NicknameResult } from '../view/nicknamePromptState';

export interface NicknameGateInput {
  /** 경쟁 모드 결과인지 (스토리는 묻지 않는다) */
  kind: 'story' | 'timeattack';
  status: OnlineStatus;
  /** getMyProfile() 결과: 닉네임이 있으면 객체, 없으면 null, 조회 실패면 'error' */
  profile: MyProfile | null | 'error';
  /** 이 판의 점수 제출이 성공했는지 (제출 결과 kind 'ok') */
  submitted: boolean;
}

export function shouldAskNickname(i: NicknameGateInput): boolean {
  return i.submitted && i.kind === 'timeattack' && i.status === 'ready' && i.profile === null;
}

/** 프로필을 읽기 전에 거를 수 있는 조건 (불필요한 요청을 피한다) */
export function mayCheckProfile(
  i: Pick<NicknameGateInput, 'kind' | 'status' | 'submitted'>,
): boolean {
  return i.submitted && i.kind === 'timeattack' && i.status === 'ready';
}

/** online의 setNickname 결과를 입력 창이 받는 모양으로 (태그는 "0427" 4자리 글자) */
export function toPromptResult(r: SetNicknameResult): NicknameResult {
  return r.ok
    ? { ok: true, nickname: r.nickname, tag: String(r.tag).padStart(4, '0') }
    : { ok: false, code: r.code };
}
