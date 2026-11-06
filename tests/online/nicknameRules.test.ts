import { describe, expect, it } from 'vitest';
import {
  BANNED_CONTAINS,
  BANNED_EXCEPTIONS,
  BANNED_PREFIX,
  BANNED_WORD_GROUPS,
} from '../../src/online/bannedWords';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  checkNickname,
  formatTag,
  isBannedNickname,
  isValidTag,
  normalizeNickname,
} from '../../src/online/nicknameRules';

/** 금칙어에 걸리면 안 되는 흔한 이름·별명 (오탐 방지). 금칙어를 더할 때 여기서 걸리면 단어를 다시 고른다 */
// prettier-ignore
const COMMON_NAMES = [
  // 아이 이름
  '이안', '이서', '보라', '서아', '하준', '서준', '도윤', '시우', '지호', '예준',
  '민준', '하윤', '지우', '수아', '서윤', '하은', '은우', '아린', '시아', '로아',
  '지아', '예지', '한나', '자윤', '보민', '지안', '공주', '운이', '관우', '리자',
  // 별명·반려동물
  '콩이', '뽀삐', '별이', '초코', '두부', '망고', '보리', '뭉치', '구름이', '자두',
  // 영문 이름
  'mina', 'leo', 'Emma', 'Olivia', 'Noah', 'Liam', 'Sophia', 'Alex', 'Grace', 'Daniel',
  'Cassie', 'Max', 'Dickens', 'Hannah', 'Jasmine', 'Ashley', 'Scott', 'Sam', 'Kim', 'Lee',
  // 숫자 섞인 별명
  '하준2018', 'leo7', '콩이123',
  // 짧은 금칙어를 품은 정상 말 (PM 리뷰 낮음 1)
  'Sussex', 'Essex', '해보지', '수학공식', 'Badminton',
];

/** 허용 예외 말마다 그것을 품은 정상 이름. 모든 예외 말에 1개 이상 있어야 한다 */
const EXCEPTION_EXAMPLES: Record<string, string[]> = {
  시발점: ['시발점', '여기가시발점'],
  시발역: ['시발역'],
  무지개새: ['무지개새', '무지개새야'],
  새끼고양이: ['새끼고양이', '콩이새끼고양이'],
  새끼강아지: ['새끼강아지'],
  새끼손가락: ['새끼손가락'],
  닥쳐오: ['닥쳐오는봄'],
  해보지: ['해보지', '한번해보지'],
  보지마: ['보지마', '울지마보지마'],
  남자지: ['남자지만'],
  여자지: ['여자지요'],
  야동생: ['누나야동생', '형아야동생'],
  sussex: ['Sussex'],
  essex: ['Essex'],
  pussycat: ['pussycat', 'Pussycat7'],
};

describe('nicknameRules 정규화', () => {
  it('앞뒤 공백을 지우고 NFC로 맞춘다', () => {
    const decomposed = '각'; // 각 (조합형 자모)
    expect(normalizeNickname(`  ${decomposed}이  `)).toBe('각이');
    expect(checkNickname(` ${decomposed}이 `)).toEqual({ ok: true, nickname: '각이' });
  });
});

describe('nicknameRules 길이', () => {
  it(`${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자 (코드 포인트 기준)`, () => {
    expect(checkNickname('가')).toEqual({ ok: false, code: 'too-short' });
    expect(checkNickname('   ')).toEqual({ ok: false, code: 'too-short' });
    expect(checkNickname('가나')).toEqual({ ok: true, nickname: '가나' });
    expect(checkNickname('가나다라마바사아자차')).toMatchObject({ ok: true });
    expect(checkNickname('가나다라마바사아자차카')).toEqual({ ok: false, code: 'too-long' });
    expect(checkNickname('abcdefghij')).toMatchObject({ ok: true });
    expect(checkNickname('abcdefghijk')).toEqual({ ok: false, code: 'too-long' });
  });
});

describe('nicknameRules 글자', () => {
  it.each([
    ['공백', '이 안'],
    ['기호', '이안!'],
    ['밑줄', 'leo_7'],
    ['이모지', '이안😀'],
    ['자모 단독', 'ㅋㅋ'],
    ['자모 섞임', '이안ㅋ'],
    ['보이지 않는 글자', '이​안'],
    ['전각 영문', 'ｌｅｏ'],
    ['키릴 흉내 글자', 'lео'],
    ['한자', '李安'],
  ])('%s → bad-chars', (_label, name) => {
    expect(checkNickname(name)).toEqual({ ok: false, code: 'bad-chars' });
  });
});

describe('nicknameRules 금칙어', () => {
  it.each(COMMON_NAMES)('흔한 이름 %s는 통과한다', (name) => {
    expect(checkNickname(name)).toEqual({ ok: true, nickname: name });
  });

  it('통과 이름 목록이 30개 이상이다', () => {
    expect(COMMON_NAMES.length).toBeGreaterThanOrEqual(30);
  });

  it('PM 재현 사례: 강한 욕설의 접미·숫자 변형을 거부한다', () => {
    for (const name of ['시발놈', '시1발놈', '새끼왕', '닥쳐라', '씨발놈', '시험시발놈']) {
      expect(checkNickname(name), name).toEqual({ ok: false, code: 'banned' });
    }
  });

  /** 1자 단어는 길이를 채워 금칙어 판정까지 가게 한다 */
  const padded = (word: string) =>
    [...word].length < NICKNAME_MIN_LENGTH ? `${word}${word}` : word;

  it('contains: 그대로·접두·접미·숫자 끼워 넣기·대문자 모두 거부한다', () => {
    for (const word of BANNED_CONTAINS) {
      const chars = [...word];
      for (const name of [
        padded(word),
        `나는${word}`,
        `${word}왕`,
        `콩이${word}놈`,
        `${chars[0]}1${chars.slice(1).join('')}`,
        `${padded(word)}7`,
        padded(word).toUpperCase(),
      ]) {
        expect(checkNickname(name), name).toEqual({ ok: false, code: 'banned' });
      }
    }
  });

  it('허용 예외 말마다 그것을 품은 정상 이름이 통과한다', () => {
    expect(Object.keys(EXCEPTION_EXAMPLES).sort()).toEqual([...BANNED_EXCEPTIONS].sort());
    for (const [exception, examples] of Object.entries(EXCEPTION_EXAMPLES)) {
      expect(examples.length, exception).toBeGreaterThan(0);
      for (const name of examples) {
        expect(name.toLowerCase(), name).toContain(exception);
        expect(checkNickname(name), name).toEqual({ ok: true, nickname: name.trim() });
      }
    }
  });

  it('허용 예외를 악용한 조합(예외 말 + 금칙어)은 거부한다', () => {
    for (const name of [
      '시발점시발',
      '시발시발점',
      '개새끼고양이',
      '무지개새끼',
      '해보지보지',
      'sussexsex',
    ]) {
      expect(checkNickname(name), name).toEqual({ ok: false, code: 'banned' });
    }
    // 길이 제한과 상관없이 모든 예외 말 × 모든 금칙어 조합을 판정 함수로 본다
    for (const exception of BANNED_EXCEPTIONS) {
      for (const word of BANNED_CONTAINS) {
        expect(isBannedNickname(`${exception}${word}`), `${exception}+${word}`).toBe(true);
        expect(isBannedNickname(`${word}${exception}`), `${word}+${exception}`).toBe(true);
      }
    }
  });

  it('prefix: 그 말로 시작하면 거부한다 (운영자 사칭)', () => {
    for (const word of BANNED_PREFIX) {
      for (const name of [word, `${word}님`, `${word}7`, word.toUpperCase()]) {
        expect(checkNickname(name), name).toEqual({ ok: false, code: 'banned' });
      }
    }
    expect(checkNickname('Ad2min7')).toEqual({ ok: false, code: 'banned' });
    expect(checkNickname('운영자123')).toEqual({ ok: false, code: 'banned' });
    expect(checkNickname('공식계정')).toEqual({ ok: false, code: 'banned' });
  });

  it('범주 4개가 모두 있고 단어는 소문자·숫자 없음·중복 없음, 예외 말은 금칙어를 품는다', () => {
    expect(Object.keys(BANNED_WORD_GROUPS)).toEqual([
      'profanity',
      'sexual',
      'hate',
      'impersonation',
    ]);
    for (const g of Object.values(BANNED_WORD_GROUPS)) {
      expect(g.contains.length + g.prefix.length).toBeGreaterThan(0);
    }
    const all = [...BANNED_CONTAINS, ...BANNED_PREFIX, ...BANNED_EXCEPTIONS];
    for (const word of all) {
      expect(word, word).toBe(word.toLowerCase());
      expect(word, word).not.toMatch(/[0-9]/);
    }
    expect(new Set(all).size).toBe(all.length);
    expect(BANNED_CONTAINS.length + BANNED_PREFIX.length).toBeLessThan(100);
    for (const exception of BANNED_EXCEPTIONS) {
      expect(
        BANNED_CONTAINS.some((word) => exception.includes(word)),
        exception,
      ).toBe(true);
    }
  });
});

describe('태그', () => {
  it('0~9999 정수만 유효하다', () => {
    expect(isValidTag(0)).toBe(true);
    expect(isValidTag(9999)).toBe(true);
    expect(isValidTag(10000)).toBe(false);
    expect(isValidTag(-1)).toBe(false);
    expect(isValidTag(1.5)).toBe(false);
    expect(isValidTag('1')).toBe(false);
  });

  it('4자리로 보인다', () => {
    expect(formatTag(427)).toBe('#0427');
    expect(formatTag(0)).toBe('#0000');
    expect(formatTag(9999)).toBe('#9999');
  });
});
