import { describe, expect, it } from 'vitest';
import { formatScore, formatTime } from '../../src/view/format';

describe('Hud 표시 형식', () => {
  it('점수는 천 단위 콤마', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
    expect(formatScore(12450)).toBe('12,450');
    expect(formatScore(1234567)).toBe('1,234,567');
  });

  it('남은 시간은 올림해서 m:ss', () => {
    expect(formatTime(60000)).toBe('1:00');
    expect(formatTime(37400)).toBe('0:38');
    expect(formatTime(100)).toBe('0:01');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
