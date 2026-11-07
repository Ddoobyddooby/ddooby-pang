import { describe, expect, it } from 'vitest';
import { initialRankLine, rankLineFor } from '../../src/scenes/rankStatus';
import { resultLayout, resultView } from '../../src/scenes/resultText';

describe('initialRankLine', () => {
  it('제출 중이면 올리는 중, run 없이 시작했으면 안 올라간다는 안내', () => {
    expect(initialRankLine({ kind: 'submitting', outcome: new Promise(() => {}) })).toBe(
      '랭킹에 올리는 중…',
    );
    expect(initialRankLine({ kind: 'unranked' })).toBe('이번 판은 랭킹에 안 올라가요');
  });

  it('오프라인·키 없음·DEV 옵션 판(none)이나 상태가 없으면 줄 없음', () => {
    expect(initialRankLine({ kind: 'none' })).toBeNull();
    expect(initialRankLine(undefined)).toBeNull();
  });
});

describe('rankLineFor', () => {
  it('성공은 이번 주 최고 점수 (천 단위 쉼표)', () => {
    expect(rankLineFor({ kind: 'ok', best: 12450, isNewBest: true })).toBe('이번 주 최고 12,450점');
  });

  it('최고 점수가 아니어도 그 주 최고 점수를 보인다', () => {
    expect(rankLineFor({ kind: 'ok', best: 9000, isNewBest: false })).toBe('이번 주 최고 9,000점');
  });

  it('실패·거부는 점수는 저장됐다는 안내', () => {
    const text = '랭킹에 올리지 못했어요 (점수는 저장됐어요)';
    expect(rankLineFor({ kind: 'failed' })).toBe(text);
    expect(rankLineFor({ kind: 'rejected', code: 'score-mismatch' })).toBe(text);
  });

  it('버전이 다르면 새로고침 안내', () => {
    expect(rankLineFor({ kind: 'outdated' })).toBe('새 버전이 있어요. 새로고침해 주세요');
  });
});

describe('결과 화면 등록 줄 배치', () => {
  const result = { kind: 'timeattack', score: 100, bestScore: 50, newBest: true } as const;
  const opts = { stageCount: 30, unlocked: 1 };

  it('rankLine이 있으면 rank 줄이 배치에 들어가고 묶음이 그만큼 길어진다', () => {
    const without = resultLayout(resultView(result, opts));
    const withLine = resultLayout(resultView(result, { ...opts, rankLine: '랭킹에 올리는 중…' }));
    expect(without.rows.rank).toBeUndefined();
    expect(withLine.rows.rank).toBeDefined();
    expect(withLine.bottom - withLine.top).toBeGreaterThan(without.bottom - without.top);
  });

  it('스토리 결과에는 rank 줄이 없다', () => {
    const story = {
      kind: 'story',
      stageId: 1,
      cleared: true,
      score: 10,
      bonus: 0,
      stars: 1,
    } as const;
    expect(resultView(story, { ...opts, rankLine: '아무거나' }).rankLine).toBeNull();
  });
});
