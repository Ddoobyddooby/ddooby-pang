// 닉네임 금칙어 (SPEC v0.2 5.1·11절 4번: 직접 관리하는 짧은 목록, 외부 목록 자동 반영 없음).
// 판정은 "소문자·숫자 제거 후 포함"이라 짧은 단어는 정상 이름까지 막는다. 넣기 전에
// tests/online/nicknameRules.test.ts의 통과 이름 목록에 걸리지 않는지 확인한다.
// 알려진 오탐: 'sex'가 Essex·Sussex 같은 지명을 막는다 (아이 닉네임에서는 드물어 감수).
// 모두 소문자, 숫자 없이 쓴다.

/** 욕설·비속어 대표형과 흔한 변형 */
const PROFANITY = [
  '씨발',
  '시발',
  '씨빨',
  '씨팔',
  '시팔',
  '쓰발',
  '병신',
  '븅신',
  '개새',
  '새끼',
  '좆',
  '존나',
  '지랄',
  '닥쳐',
  '미친놈',
  '미친년',
  'fuck',
  'shit',
  'bitch',
];

/** 성적 표현 */
const SEXUAL = ['섹스', '보지', '자지', '야동', '강간', 'sex', 'porn', 'pussy', 'slut', 'whore'];

/** 혐오·비하 */
const HATE = [
  '한남충',
  '김치녀',
  '된장녀',
  '맘충',
  '틀딱',
  '급식충',
  '짱깨',
  '쪽바리',
  '깜둥',
  '니애미',
  '느금',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'hitler',
];

/** 운영자 사칭 */
const IMPERSONATION = ['운영자', '운영진', '관리자', '공식', 'admin', 'official'];

export const BANNED_WORD_GROUPS = {
  profanity: PROFANITY,
  sexual: SEXUAL,
  hate: HATE,
  impersonation: IMPERSONATION,
} as const;

export const BANNED_WORDS: readonly string[] = [...PROFANITY, ...SEXUAL, ...HATE, ...IMPERSONATION];
