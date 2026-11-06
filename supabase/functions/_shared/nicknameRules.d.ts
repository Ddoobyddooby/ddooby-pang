// 자동 생성: npm run server:shared (src/online/nicknameRules.ts). 직접 고치지 않는다
/** 길이 하한·상한 (코드 포인트 기준. 한글 완성형 1자 = 1) */
export declare const NICKNAME_MIN_LENGTH = 2;
export declare const NICKNAME_MAX_LENGTH = 10;
/** 태그 범위. 화면에는 `#0427`처럼 4자리로 보인다 */
export declare const TAG_MIN = 0;
export declare const TAG_MAX = 9999;
/** 같은 닉네임 안에서 태그가 겹칠 때 다시 뽑는 최대 횟수. 넘으면 server 오류 */
export declare const TAG_MAX_ATTEMPTS = 20;
export type NicknameErrorCode = 'too-short' | 'too-long' | 'bad-chars' | 'banned';
export type NicknameCheck = {
    ok: true;
    nickname: string;
} | {
    ok: false;
    code: NicknameErrorCode;
};
/** 앞뒤 공백 제거 + NFC 정규화 (조합형으로 들어온 한글을 완성형으로 맞춘다) */
export declare function normalizeNickname(input: string): string;
/** 소문자로 바꾸고 숫자를 뺀 문자열에 금칙어가 들어 있으면 true (`시1발` 같은 끼워 넣기 차단) */
export declare function containsBannedWord(nickname: string): boolean;
export declare function checkNickname(input: string): NicknameCheck;
export declare function isValidTag(tag: unknown): tag is number;
/** `#0427`처럼 4자리 */
export declare function formatTag(tag: number): string;
