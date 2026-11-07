import { describe, expect, it } from 'vitest';
import {
  mayCheckProfile,
  shouldAskNickname,
  toPromptResult,
  type NicknameGateInput,
} from '../../src/scenes/nicknameGate';

const base: NicknameGateInput = {
  kind: 'timeattack',
  status: 'ready',
  profile: null,
  submitted: true,
};

describe('닉네임 입력 창을 띄울지', () => {
  it('경쟁 + 온라인 준비됨 + 닉네임 없음 + DEV ?ranking이면 띄운다', () => {
    expect(shouldAskNickname(base)).toBe(true);
  });

  it('점수 제출이 성공하지 못했으면 띄우지 않는다', () => {
    expect(shouldAskNickname({ ...base, submitted: false })).toBe(false);
  });

  it('스토리 결과에서는 묻지 않는다', () => {
    expect(shouldAskNickname({ ...base, kind: 'story' })).toBe(false);
  });

  it.each(['disabled', 'offline', 'signing-in'] as const)(
    '온라인 상태 %s이면 묻지 않는다',
    (status) => {
      expect(shouldAskNickname({ ...base, status })).toBe(false);
    },
  );

  it('닉네임이 이미 있거나 프로필 조회가 실패하면 묻지 않는다', () => {
    expect(shouldAskNickname({ ...base, profile: { nickname: '시험이안', tag: 427 } })).toBe(false);
    expect(shouldAskNickname({ ...base, profile: 'error' })).toBe(false);
  });

  it('프로필을 읽기 전 조건: 조건이 안 맞으면 요청 자체를 하지 않는다', () => {
    expect(mayCheckProfile(base)).toBe(true);
    expect(mayCheckProfile({ ...base, status: 'offline' })).toBe(false);
    expect(mayCheckProfile({ ...base, submitted: false })).toBe(false);
    expect(mayCheckProfile({ ...base, kind: 'story' })).toBe(false);
  });
});

describe('setNickname 결과 → 입력 창 결과', () => {
  it('성공: 태그를 4자리 글자로', () => {
    expect(toPromptResult({ ok: true, nickname: '시험이안', tag: 427 })).toEqual({
      ok: true,
      nickname: '시험이안',
      tag: '0427',
    });
    expect(toPromptResult({ ok: true, nickname: 'a1', tag: 12345 })).toMatchObject({
      tag: '12345',
    });
  });

  it('실패: code를 그대로', () => {
    expect(toPromptResult({ ok: false, code: 'banned' })).toEqual({ ok: false, code: 'banned' });
    expect(toPromptResult({ ok: false, code: 'network' })).toEqual({ ok: false, code: 'network' });
  });
});
