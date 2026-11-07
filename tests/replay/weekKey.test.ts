// 주간 랭킹의 주 (SPEC 5.2): KST 날짜의 ISO 주차, 월요일 00:00 KST에 바뀐다
import { describe, expect, it } from 'vitest';
import { weekKey } from '../../src/replay/weekKey';

/** KST 벽시계 시각 → Unix ms */
const kst = (y: number, mon: number, d: number, h = 0, min = 0, s = 0) =>
  Date.UTC(y, mon - 1, d, h - 9, min, s);

describe('weekKey', () => {
  it('2026-11-09(월)부터 2026-W46 (SPEC 예시)', () => {
    expect(weekKey(kst(2026, 11, 9))).toBe('2026-W46');
    expect(weekKey(kst(2026, 11, 15, 23, 59, 59))).toBe('2026-W46');
  });

  it('일요일 23:59:59 KST ↔ 월요일 00:00 KST 경계', () => {
    expect(weekKey(kst(2026, 11, 8, 23, 59, 59))).toBe('2026-W45');
    expect(weekKey(kst(2026, 11, 8, 23, 59, 59) + 999)).toBe('2026-W45');
    expect(weekKey(kst(2026, 11, 9, 0, 0, 0))).toBe('2026-W46');
  });

  it('UTC 일요일 15:00 = KST 월요일 00:00: UTC 날짜가 아니라 KST 날짜로 정한다', () => {
    const ms = Date.UTC(2026, 10, 8, 15, 0, 0); // UTC 11-08(일) 15:00
    expect(new Date(ms).getUTCDay()).toBe(0);
    expect(weekKey(ms)).toBe('2026-W46');
    expect(weekKey(ms - 1)).toBe('2026-W45');
  });

  it('연말·연초: W53이 있는 해, 1월 초가 전년도 주, 12월 말이 다음 해 W01', () => {
    // 2026-12-31은 목요일 → 2026년은 W53까지 있다
    expect(weekKey(kst(2026, 12, 31, 12))).toBe('2026-W53');
    expect(weekKey(kst(2027, 1, 3, 23, 59, 59))).toBe('2026-W53'); // 일요일
    expect(weekKey(kst(2027, 1, 4))).toBe('2027-W01'); // 월요일
    // 2025-12-29(월)은 2026-W01 (2026-01-01이 목요일)
    expect(weekKey(kst(2025, 12, 28, 23, 59, 59))).toBe('2025-W52');
    expect(weekKey(kst(2025, 12, 29))).toBe('2026-W01');
    // 2027-12-31(금)·2028-01-02(일)은 2027-W52, 2028-01-03(월)은 2028-W01
    expect(weekKey(kst(2027, 12, 31))).toBe('2027-W52');
    expect(weekKey(kst(2028, 1, 2, 23))).toBe('2027-W52');
    expect(weekKey(kst(2028, 1, 3))).toBe('2028-W01');
  });

  it('두 자리 주 번호', () => {
    expect(weekKey(kst(2026, 1, 5))).toBe('2026-W02');
  });
});
