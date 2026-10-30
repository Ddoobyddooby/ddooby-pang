import { describe, expect, it } from 'vitest';
import { formatScore, previewResult, resultView } from '../../src/scenes/resultText';
import type { ModeResult } from '../../src/modes/GameMode';

describe('scenes/resultText', () => {
  it('formatScore: 천 단위 콤마', () => {
    expect([0, 999, 1000, 12450, 1234567].map(formatScore)).toEqual([
      '0',
      '999',
      '1,000',
      '12,450',
      '1,234,567',
    ]);
  });

  it('formatScore: 소수·음수가 들어와도 정수로 보여 준다', () => {
    expect(formatScore(1234.9)).toBe('1,234');
    expect(formatScore(-5)).toBe('0');
    expect(formatScore(NaN)).toBe('0');
  });

  it('previewResult: ?result=N(&best=M) → 가짜 타임어택 결과', () => {
    expect(previewResult('?result=12450&best=9000')).toEqual({
      kind: 'timeattack',
      score: 12450,
      bestScore: 9000,
      newBest: true,
    });
    expect(previewResult('?result=500&best=9000')).toMatchObject({ newBest: false });
    expect(previewResult('?result=300')).toEqual({
      kind: 'timeattack',
      score: 300,
      bestScore: 0,
      newBest: true,
    });
    expect(previewResult('?seed=7')).toBeNull();
    expect(previewResult('?result=abc')).toMatchObject({ score: 0, newBest: false });
  });
});

describe('scenes/resultText: previewResult 스토리 (설계 4절)', () => {
  it('?stage가 있으면 스토리 결과. stars=0이면 실패', () => {
    expect(previewResult('?result=3200&stage=2&stars=2&bonus=900')).toEqual({
      kind: 'story',
      stageId: 2,
      cleared: true,
      score: 3200,
      bonus: 900,
      stars: 2,
    });
    expect(previewResult('?result=800&stage=4&stars=0')).toEqual({
      kind: 'story',
      stageId: 4,
      cleared: false,
      score: 800,
      bonus: 0,
      stars: 0,
    });
    // 별은 0~3으로 맞춘다
    expect(previewResult('?result=1&stage=1&stars=9')).toMatchObject({ stars: 3, cleared: true });
  });
});

describe('scenes/resultText: resultView (설계 4절 표)', () => {
  const story = (over: Partial<Extract<ModeResult, { kind: 'story' }>> = {}): ModeResult => ({
    kind: 'story',
    stageId: 2,
    cleared: true,
    score: 3200,
    bonus: 900,
    stars: 2,
    ...over,
  });
  const ta: ModeResult = { kind: 'timeattack', score: 500, bestScore: 900, newBest: false };

  it('경쟁: 끝!, 별 없음, 최고 점수 줄, [다시하기] [메뉴]', () => {
    expect(resultView(ta, { stageCount: 10, unlocked: 1 })).toEqual({
      title: '끝!',
      stars: null,
      best: '최고 점수 900',
      newBest: false,
      bonus: null,
      allClear: false,
      buttons: ['retry', 'menu'],
    });
    const best = resultView({ ...ta, score: 1200, newBest: true }, { stageCount: 10, unlocked: 1 });
    expect(best).toMatchObject({ best: '최고 점수 1,200', newBest: true });
  });

  it('스토리 클리어 + 다음 스테이지 열림: [다음 스테이지] [다시하기] [지도]', () => {
    expect(resultView(story(), { stageCount: 10, unlocked: 3 })).toEqual({
      title: '클리어!',
      stars: 2,
      best: null,
      newBest: false,
      bonus: '남은 이동 보너스 +900',
      allClear: false,
      buttons: ['next', 'retry', 'map'],
    });
  });

  it('스토리 클리어인데 다음 스테이지가 아직 잠겨 있으면 [다음 스테이지] 없음', () => {
    expect(resultView(story(), { stageCount: 10, unlocked: 2 }).buttons).toEqual(['retry', 'map']);
  });

  it('보너스 0이면 보너스 줄 없음', () => {
    expect(resultView(story({ bonus: 0 }), { stageCount: 10, unlocked: 3 }).bonus).toBeNull();
  });

  it('마지막 스테이지 클리어: 다음 대신 "모든 스테이지 클리어!"', () => {
    const view = resultView(story({ stageId: 10 }), { stageCount: 10, unlocked: 11 });
    expect(view.allClear).toBe(true);
    expect(view.buttons).toEqual(['retry', 'map']);
  });

  it('스토리 실패: 아쉬워요, 빈 별 3칸(0), 보너스 줄 없음, [다시하기] [지도]', () => {
    expect(
      resultView(story({ cleared: false, stars: 0, bonus: 0 }), { stageCount: 10, unlocked: 3 }),
    ).toEqual({
      title: '아쉬워요',
      stars: 0,
      best: null,
      newBest: false,
      bonus: null,
      allClear: false,
      buttons: ['retry', 'map'],
    });
    // 실패면 10번이어도 "모든 스테이지 클리어!"가 아니다
    expect(
      resultView(story({ stageId: 10, cleared: false, stars: 0 }), { stageCount: 10, unlocked: 10 })
        .allClear,
    ).toBe(false);
  });
});
