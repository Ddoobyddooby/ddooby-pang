import { describe, expect, it } from 'vitest';
import {
  applyResult,
  chooseLater,
  initialPromptState,
  isLocked,
  PROMPT_TIMINGS,
  shouldSubmitOnEnter,
  startSubmit,
  type NicknameResult,
} from '../../src/view/nicknamePromptState';
import { NICKNAME_TEXT, type NicknameErrorCode } from '../../src/view/nicknameText';
import { parsePreviewResult } from '../../src/dev/nicknamePreview';

const submitting = () => startSubmit(initialPromptState());
const fail = (code: NicknameErrorCode): NicknameResult => ({ ok: false, code });

describe('닉네임 창 상태', () => {
  it('처음엔 입력 가능, 확인을 누르면 제출 중으로 잠긴다', () => {
    const s0 = initialPromptState();
    expect(isLocked(s0)).toBe(false);
    const s1 = startSubmit(s0);
    expect(s1.phase).toBe('submitting');
    expect(isLocked(s1)).toBe(true);
  });

  it('제출 중에는 또 제출하거나 [나중에]를 눌러도 상태가 안 바뀐다 (두 번 제출 방지)', () => {
    const s = submitting();
    expect(startSubmit(s)).toBe(s);
    expect(chooseLater(s)).toBe(s);
  });

  it('[나중에]: 입력 중이면 "기록이 랭킹에 안 보인다" 안내를 잠깐 보여 준 뒤 later로 닫는다', () => {
    const s = chooseLater(initialPromptState());
    expect(s.message).toEqual({
      kind: 'info',
      text: '이름을 정하기 전까지 기록이 랭킹에 보이지 않아요',
    });
    expect(s).toMatchObject({ phase: 'closing', outcome: 'later', closeAfterMs: 1500 });
    expect(isLocked(s)).toBe(true);
  });

  it('저장 전 안내 문구: 한 번 정하면 바꿀 수 없다', () => {
    expect(NICKNAME_TEXT.notice).toBe('한 번 정하면 바꿀 수 없어요');
  });

  it('성공: 문구 "이안#0427 으로 정했어요", 1.2초 뒤 saved로 닫힌다', () => {
    const s = applyResult(submitting(), { ok: true, nickname: '이안', tag: '0427' });
    expect(s.message).toEqual({ kind: 'info', text: '이안#0427 으로 정했어요' });
    expect(s).toMatchObject({ phase: 'closing', outcome: 'saved', closeAfterMs: 1200 });
  });

  it.each([
    ['too-short', '두 글자 이상 써 주세요'],
    ['too-long', '열 글자까지 쓸 수 있어요'],
    ['bad-chars', '한글·영문·숫자만 쓸 수 있어요'],
    ['banned', '쓸 수 없는 말이 들어 있어요'],
  ] as const)('규칙 위반 %s: 입력으로 돌아가 이유를 보여 주고 다시 쓸 수 있다', (code, text) => {
    const s = applyResult(submitting(), fail(code));
    expect(s).toMatchObject({ phase: 'input', outcome: null });
    expect(s.message).toEqual({ kind: 'error', text });
    expect(isLocked(s)).toBe(false);
    expect(startSubmit(s).phase).toBe('submitting');
  });

  it('already-set: 안내 후 saved로 닫힌다', () => {
    const s = applyResult(submitting(), fail('already-set'));
    expect(s.message?.text).toBe('이미 이름이 있어요');
    expect(s).toMatchObject({ phase: 'closing', outcome: 'saved', closeAfterMs: 1200 });
  });

  it.each(['network', 'server', 'unauthorized'] as const)(
    '%s: 연결 안 됨 안내 후 1.5초 뒤 failed로 닫힌다',
    (code) => {
      const s = applyResult(submitting(), fail(code));
      expect(s.message?.text).toBe('지금은 연결이 안 돼요. 다음에 다시 물어볼게요');
      expect(s).toMatchObject({ phase: 'closing', outcome: 'failed', closeAfterMs: 1500 });
    },
  );

  it('제출 중이 아닐 때 온 결과는 무시한다 (닫힌 뒤 늦게 도착한 응답)', () => {
    const closing = applyResult(submitting(), { ok: true, nickname: 'a', tag: '0001' });
    expect(applyResult(closing, fail('banned'))).toBe(closing);
    const input = initialPromptState();
    expect(applyResult(input, fail('banned'))).toBe(input);
  });

  it('모든 오류 code에 문구가 있고 시간은 PROMPT_TIMINGS 값이다', () => {
    for (const code of Object.keys(NICKNAME_TEXT.errors) as NicknameErrorCode[]) {
      expect(NICKNAME_TEXT.errors[code].length).toBeGreaterThan(0);
    }
    expect(PROMPT_TIMINGS).toEqual({ savedMs: 1200, failedMs: 1500, laterMs: 1500 });
  });
});

describe('Enter 제출', () => {
  it('Enter만 제출, 한글 조합 중(isComposing·keyCode 229)이면 제출하지 않는다', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter' })).toBe(true);
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: true })).toBe(false);
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: false, keyCode: 229 })).toBe(false);
    expect(shouldSubmitOnEnter({ key: 'a' })).toBe(false);
  });
});

describe('DEV ?nickname 값', () => {
  it('오류 code는 그대로, 그 밖(없음·모름)은 ok', () => {
    expect(parsePreviewResult('banned')).toBe('banned');
    expect(parsePreviewResult('network')).toBe('network');
    expect(parsePreviewResult('ok')).toBe('ok');
    expect(parsePreviewResult('')).toBe('ok');
    expect(parsePreviewResult(null)).toBe('ok');
  });
});
