import { describe, expect, it } from 'vitest';
import { RESULT } from '../../src/config';
import {
  formatScore,
  previewResult,
  resultLayout,
  resultSounds,
  resultView,
} from '../../src/scenes/resultText';
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

  it('경쟁: 끝!, 별 없음, 최고 점수 줄, [다시하기] [랭킹 보기] [메뉴]', () => {
    expect(resultView(ta, { stageCount: 10, unlocked: 1 })).toEqual({
      title: '끝!',
      stars: null,
      best: '최고 점수 900',
      newBest: false,
      bonus: null,
      rankLine: null,
      allClear: false,
      buttons: ['retry', 'ranking', 'menu'],
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
      rankLine: null,
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
      rankLine: null,
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

describe('resultSounds (PLAN 6.15)', () => {
  const ta = (score: number, bestScore: number): ModeResult => ({
    kind: 'timeattack',
    score,
    bestScore,
    newBest: score > bestScore,
  });
  const story = (cleared: boolean): ModeResult => ({
    kind: 'story',
    stageId: 1,
    cleared,
    score: 100,
    bonus: 0,
    stars: cleared ? 1 : 0,
  });

  it.each([
    ['경쟁 최고 기록 갱신', ta(1200, 900), ['newbest', 'applause']],
    ['경쟁 첫 판 (최고 0, 점수 > 0)', ta(300, 0), ['newbest', 'applause']],
    ['경쟁 못 깸', ta(500, 900), ['nobest']],
    ['경쟁 최고와 같은 점수', ta(900, 900), ['nobest']],
    ['경쟁 첫 판인데 점수 0', ta(0, 0), ['nobest']],
    ['스토리 클리어', story(true), ['clear']],
    ['스토리 실패', story(false), ['fail']],
  ])('%s', (_, result, sounds) => {
    expect(resultSounds(result)).toEqual(sounds);
  });
});

describe('resultLayout (W4-14)', () => {
  const ta = resultView(
    { kind: 'timeattack', score: 1200, bestScore: 900, newBest: true },
    { stageCount: 10, unlocked: 1 },
  );
  const clear = resultView(
    { kind: 'story', stageId: 2, cleared: true, stars: 3, score: 2400, bonus: 300 },
    { stageCount: 10, unlocked: 3 },
  );
  const fail = resultView(
    { kind: 'story', stageId: 2, cleared: false, stars: 0, score: 500, bonus: 0 },
    { stageCount: 10, unlocked: 2 },
  );

  it.each([
    ['경쟁', ta],
    ['스토리 클리어', clear],
    ['실패', fail],
  ])('%s: 묶음이 화면 가운데에 놓인다', (_name, view) => {
    const l = resultLayout(view);
    expect(l.top + l.bottom).toBeCloseTo(0);
  });

  it.each([
    ['경쟁', ta],
    ['스토리 클리어', clear],
    ['실패', fail],
  ])('%s: 줄 사이는 RESULT.layout 간격이고 겹치지 않는다', (_name, view) => {
    const { gap, scoreGap, h } = RESULT.layout;
    const l = resultLayout(view);
    const rows = Object.entries(l.rows).sort((a, b) => a[1] - b[1]) as [keyof typeof h, number][];
    for (let i = 1; i < rows.length; i++) {
      const [prev, py] = rows[i - 1]!;
      const [cur, y] = rows[i]!;
      const space = y - h[cur] / 2 - (py + h[prev] / 2);
      expect(space).toBeCloseTo(cur === 'score' ? scoreGap : gap);
    }
    // 마지막 줄과 첫 버튼 사이
    const [last, ly] = rows[rows.length - 1]!;
    expect(l.buttons[0]! - RESULT.button.height / 2 - (ly + h[last] / 2)).toBeCloseTo(
      RESULT.layout.beforeButtons,
    );
  });

  it('경쟁은 별 줄이 없고, 최고 점수 줄 아래에 배지가 gap만큼 떨어진다', () => {
    const l = resultLayout(ta);
    expect(l.rows.stars).toBeUndefined();
    const { h, gap } = RESULT.layout;
    expect(l.rows.badge! - h.badge / 2 - (l.rows.line! + h.line / 2)).toBeCloseTo(gap);
  });

  it('버튼 수만큼 위치가 있고 step 간격', () => {
    const l = resultLayout(clear);
    expect(l.buttons).toHaveLength(clear.buttons.length);
    expect(l.buttons[1]! - l.buttons[0]!).toBe(RESULT.button.step);
  });
});
