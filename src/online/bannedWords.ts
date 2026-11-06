// 닉네임 금칙어 (SPEC v0.2 5.1·11절 4번: 직접 관리하는 짧은 목록, 외부 목록 자동 반영 없음).
// 판정 전에 닉네임을 소문자로 바꾸고 숫자를 뺀다 (`시1발` → `시발`). 목록은 세 가지:
//
// - contains:   들어 있기만 해도 거부. 욕설·성적 표현·비하는 모두 여기 둔다 (시발놈·새끼왕 같은 접두·접미 변형 차단)
// - exceptions: contains 금칙어가 이 정상 말 안에 들어 있을 때만 봐준다 (시발점, 해보지, Sussex …).
//               금칙어가 나온 자리마다 예외 말에 덮여 있는지 보고, 하나라도 바깥에 있으면 거부한다
//               (`시발점시발`, `개새끼고양이` → 거부). 금칙어마다 아이가 쓸 법한 말만 짧게 둔다
// - prefix:     그 말로 시작하면 거부. 운영자 사칭용. 사칭은 직함을 앞에 붙이는 형태(관리자님, admin7,
//               공식계정)가 대부분이고, 이 말들로 시작하는 정상 이름은 드물다. 포함 검사는 수학공식·
//               Badminton을 막았고, 완전 일치는 관리자님·운영자뚜비를 놓쳐서 접두 일치로 정했다
//
// 완전 일치 목록은 두지 않는다. 정상 말 안에 나오는 짧은 말도 예외 목록으로 풀면 접두·접미 변형까지 막을 수 있다.
// 새 단어를 넣을 때는 tests/online/nicknameRules.test.ts의 통과 이름 목록에 걸리지 않는지 확인하고,
// 예외 말은 그것을 품은 정상 이름 예시를 테스트에 함께 넣는다. 모두 소문자, 숫자 없이 쓴다.

export interface BannedWordList {
  contains: readonly string[];
  exceptions: readonly string[];
  prefix: readonly string[];
}

/** 욕설·비속어 대표형과 흔한 변형 */
const PROFANITY: BannedWordList = {
  contains: [
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
  ],
  exceptions: [
    '시발점', // 시발: 출발점
    '시발역', // 시발: 첫 역
    '무지개새', // 개새: 무지개 + 새
    '새끼고양이', // 새끼: 어린 동물
    '새끼강아지',
    '새끼손가락',
    '닥쳐오', // 닥쳐: 닥쳐오는봄 (닥쳐라는 그대로 거부)
  ],
  prefix: [],
};

/** 성적 표현 */
const SEXUAL: BannedWordList = {
  contains: ['섹스', '강간', '보지', '자지', '야동', 'sex', 'porn', 'pussy', 'slut', 'whore'],
  exceptions: [
    '해보지', // 보지: "보다"의 활용
    '보지마',
    '남자지', // 자지: 남자지만·여자지요
    '여자지',
    '야동생', // 야동: 호격 "야" + 동생 (누나야동생)
    'sussex', // sex: 지명
    'essex',
    'pussycat', // pussy: 고양이
  ],
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
  exceptions: [],
  prefix: [],
};

/** 운영자 사칭 */
const IMPERSONATION: BannedWordList = {
  contains: [],
  exceptions: [],
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
export const BANNED_EXCEPTIONS: readonly string[] = groups.flatMap((g) => g.exceptions);
export const BANNED_PREFIX: readonly string[] = groups.flatMap((g) => g.prefix);
