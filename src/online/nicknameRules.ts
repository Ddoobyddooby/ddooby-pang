// 닉네임 규칙 (SPEC v0.2 5.1, PLAN2 6.3). 클라이언트(즉시 안내)와 set-nickname 함수(최종 판정)가 같이 쓴다.
// 서버용은 `npm run server:shared`가 이 파일을 supabase/functions/_shared/nicknameRules.js로 묶는다.
// 그래서 bannedWords 말고는 import하지 않는다 (config.ts를 끌어오면 서버 번들에 화면 값까지 들어간다)
import { BANNED_CONTAINS, BANNED_EXACT, BANNED_PREFIX } from './bannedWords';

/** 길이 하한·상한 (코드 포인트 기준. 한글 완성형 1자 = 1) */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 10;
/** 태그 범위. 화면에는 `#0427`처럼 4자리로 보인다 */
export const TAG_MIN = 0;
export const TAG_MAX = 9999;
/** 같은 닉네임 안에서 태그가 겹칠 때 다시 뽑는 최대 횟수. 넘으면 server 오류 */
export const TAG_MAX_ATTEMPTS = 20;

export type NicknameErrorCode = 'too-short' | 'too-long' | 'bad-chars' | 'banned';

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; code: NicknameErrorCode };

/** 한글 완성형(가~힣), 영문, 숫자만. 공백·기호·이모지·자모 단독·보이지 않는 글자는 안 된다 */
const ALLOWED = /^[가-힣A-Za-z0-9]+$/;

/** 앞뒤 공백 제거 + NFC 정규화 (조합형으로 들어온 한글을 완성형으로 맞춘다) */
export function normalizeNickname(input: string): string {
  return input.normalize('NFC').trim();
}

/**
 * 소문자로 바꾸고 숫자를 뺀 문자열(`시1발` → `시발`)을 bannedWords의 세 목록과 맞춘다:
 * 포함(contains) / 전체 일치(exact) / 시작(prefix)
 */
export function isBannedNickname(nickname: string): boolean {
  const folded = nickname.toLowerCase().replace(/[0-9]/g, '');
  return (
    BANNED_CONTAINS.some((word) => folded.includes(word)) ||
    BANNED_EXACT.includes(folded) ||
    BANNED_PREFIX.some((word) => folded.startsWith(word))
  );
}

export function checkNickname(input: string): NicknameCheck {
  const nickname = normalizeNickname(input);
  const length = [...nickname].length;
  if (length < NICKNAME_MIN_LENGTH) return { ok: false, code: 'too-short' };
  if (length > NICKNAME_MAX_LENGTH) return { ok: false, code: 'too-long' };
  if (!ALLOWED.test(nickname)) return { ok: false, code: 'bad-chars' };
  if (isBannedNickname(nickname)) return { ok: false, code: 'banned' };
  return { ok: true, nickname };
}

export function isValidTag(tag: unknown): tag is number {
  return typeof tag === 'number' && Number.isInteger(tag) && tag >= TAG_MIN && tag <= TAG_MAX;
}

/** `#0427`처럼 4자리 */
export function formatTag(tag: number): string {
  return `#${String(tag).padStart(4, '0')}`;
}
