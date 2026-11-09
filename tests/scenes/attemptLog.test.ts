// 스토리 플레이 로그를 보낼 판 판정·보낼 값 (V2-W4-02, PLAN2 6.7)
import { describe, expect, it } from 'vitest';
import type { ModeResult } from '../../src/modes/GameMode';
import { shouldLogAttempt, stageAttemptOf } from '../../src/scenes/attemptLog';

describe('shouldLogAttempt', () => {
  const base = { devStage: false, demo: false, dev: false, search: '' };

  it('배포 빌드의 보통 스토리 판은 보낸다', () => {
    expect(shouldLogAttempt(base)).toBe(true);
    expect(shouldLogAttempt({ ...base, search: '?stage=3' })).toBe(true);
  });

  it('DEV 빌드는 ?attemptlog가 있을 때만 보낸다', () => {
    expect(shouldLogAttempt({ ...base, dev: true })).toBe(false);
    expect(shouldLogAttempt({ ...base, dev: true, search: '?stage=1' })).toBe(false);
    expect(shouldLogAttempt({ ...base, dev: true, search: '?attemptlog&stage=1' })).toBe(true);
    expect(shouldLogAttempt({ ...base, dev: true, search: '?stage=1&attemptlog=1' })).toBe(true);
  });

  it('demo·devStage는 ?attemptlog가 있어도, 배포 빌드여도 보내지 않는다', () => {
    for (const dev of [false, true]) {
      const search = '?attemptlog';
      expect(shouldLogAttempt({ ...base, dev, search, demo: true })).toBe(false);
      expect(shouldLogAttempt({ ...base, dev, search, devStage: true })).toBe(false);
    }
  });
});

describe('stageAttemptOf', () => {
  const story = (cleared: boolean): Extract<ModeResult, { kind: 'story' }> => ({
    kind: 'story',
    stageId: 4,
    cleared,
    score: 3300,
    bonus: cleared ? 300 : 0,
    stars: cleared ? 1 : 0,
  });

  it('클리어 → clear, 남은 이동은 넘겨받은 값(보너스 전), 점수는 보너스 포함', () => {
    expect(stageAttemptOf(story(true), 3, 2)).toEqual({
      stageId: 4,
      result: 'clear',
      movesLeft: 3,
      score: 3300,
      stars: 1,
      attemptNo: 2,
    });
  });

  it('실패 → fail', () => {
    expect(stageAttemptOf(story(false), 0, 1)).toMatchObject({ result: 'fail', movesLeft: 0 });
  });
});
