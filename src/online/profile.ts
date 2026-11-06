// 닉네임 읽기·정하기 (PLAN2 6.3). 쓰기는 Edge Function set-nickname만 한다 (profiles는 클라이언트 쓰기 금지)
import type { Account } from './account';
import { checkNickname, isValidTag, type NicknameErrorCode } from './nicknameRules';

export interface MyProfile {
  nickname: string;
  tag: number;
}

export type SetNicknameErrorCode =
  NicknameErrorCode | 'already-set' | 'network' | 'server' | 'unauthorized';

export type SetNicknameResult =
  { ok: true; nickname: string; tag: number } | { ok: false; code: SetNicknameErrorCode };

const RULE_CODES: readonly string[] = [
  'too-short',
  'too-long',
  'bad-chars',
  'banned',
] satisfies NicknameErrorCode[];

export interface Profile {
  /** 닉네임이 있으면 {nickname, tag}, 아직 없으면 null, 계정 없음·조회 실패면 'error' */
  getMyProfile(): Promise<MyProfile | null | 'error'>;
  setNickname(name: string): Promise<SetNicknameResult>;
}

export function createProfile(account: Account): Profile {
  return {
    async getMyProfile() {
      const backend = account.backend();
      const userId = account.userId();
      if (!backend || !userId) return 'error';
      try {
        const row = await backend.fetchProfile(userId);
        if (!row || row.nickname === null || !isValidTag(row.tag)) return null;
        return { nickname: row.nickname, tag: row.tag };
      } catch {
        return 'error';
      }
    },

    async setNickname(name) {
      const check = checkNickname(name);
      if (!check.ok) return check;
      const backend = account.backend();
      if (!backend) return { ok: false, code: 'network' };
      let res;
      try {
        res = await backend.callFunction('set-nickname', { nickname: check.nickname });
      } catch {
        return { ok: false, code: 'network' };
      }
      if (res === 'network') return { ok: false, code: 'network' };
      const body = (typeof res.body === 'object' && res.body !== null ? res.body : {}) as Record<
        string,
        unknown
      >;
      switch (res.status) {
        case 200:
          return typeof body.nickname === 'string' && isValidTag(body.tag)
            ? { ok: true, nickname: body.nickname, tag: body.tag }
            : { ok: false, code: 'server' };
        case 400:
          return typeof body.code === 'string' && RULE_CODES.includes(body.code)
            ? { ok: false, code: body.code as NicknameErrorCode }
            : { ok: false, code: 'server' };
        case 401:
          return { ok: false, code: 'unauthorized' };
        case 409:
          return { ok: false, code: 'already-set' };
        default:
          return { ok: false, code: 'server' };
      }
    },
  };
}
