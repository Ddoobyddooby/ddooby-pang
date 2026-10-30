import { describe, expect, it } from 'vitest';
import { formatScore, previewResult } from '../../src/scenes/resultText';

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
