// 닉네임 금칙어 (SPEC v0.2 5.1·11절 4번: 직접 관리하는 짧은 목록, 외부 목록 자동 반영 없음).
// 판정 전에 닉네임을 소문자로 바꾸고 숫자를 뺀다 (`시1발` → `시발`). 목록은 세 가지로 나눈다:
//
// - contains: 들어 있기만 해도 거부. 정상 단어 안에 거의 나오지 않는 강한 욕설·비하 표현만 둔다
// - exact:    닉네임 전체가 그 말일 때만 거부. 정상 단어 안에도 나오는 짧은 말
//             (예: 해보지·남자지·무지개새·새끼고양이·시발점·Sussex·pussycat)
// - prefix:   그 말로 시작하면 거부. 운영자 사칭용. 사칭은 직함을 앞에 붙이는 형태(관리자님, admin7,
//             공식계정)가 대부분이고, 이 말들로 시작하는 정상 이름은 드물다. 포함 검사는 수학공식·
//             Badminton을 막았고, 완전 일치는 관리자님·운영자뚜비를 놓쳐서 접두 일치로 정했다
//
// 새 단어를 넣을 때는 tests/online/nicknameRules.test.ts의 통과 이름 목록에 걸리지 않는지 확인하고,
// exact 단어는 그 말을 품은 정상 단어 예시를 통과 목록에 함께 넣는다. 모두 소문자, 숫자 없이 쓴다.

export interface BannedWordList {
  contains: readonly string[];
  exact: readonly string[];
  prefix: readonly string[];
}

/** 욕설·비속어 대표형과 흔한 변형 */
const PROFANITY: BannedWordList = {
  contains: [
    '씨발',
    '씨빨',
    '씨팔',
    '시팔',
    '쓰발',
    '병신',
    '븅신',
    '개새끼',
    '좆',
    '존나',
    '지랄',
    '미친놈',
    '미친년',
    'fuck',
    'shit',
    'bitch',
  ],
  exact: ['시발', '개새', '새끼', '닥쳐'],
  prefix: [],
};

/** 성적 표현 */
const SEXUAL: BannedWordList = {
  contains: ['섹스', '강간', 'porn', 'slut', 'whore'],
  exact: ['보지', '자지', '야동', 'sex', 'pussy'],
  prefix: [],
};

/** 혐오·비하 */
const HATE: BannedWordList = {
  contains: [
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
  ],
  exact: [],
  prefix: [],
};

/** 운영자 사칭 */
const IMPERSONATION: BannedWordList = {
  contains: [],
  exact: [],
  prefix: ['운영자', '운영진', '관리자', '공식', 'admin', 'official'],
};

export const BANNED_WORD_GROUPS = {
  profanity: PROFANITY,
  sexual: SEXUAL,
  hate: HATE,
  impersonation: IMPERSONATION,
} as const;

const groups = Object.values(BANNED_WORD_GROUPS);

export const BANNED_CONTAINS: readonly string[] = groups.flatMap((g) => g.contains);
export const BANNED_EXACT: readonly string[] = groups.flatMap((g) => g.exact);
export const BANNED_PREFIX: readonly string[] = groups.flatMap((g) => g.prefix);
