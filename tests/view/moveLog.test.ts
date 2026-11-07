import { describe, expect, it } from 'vitest';
import { MoveLog, moveTime } from '../../src/view/moveLog';

describe('moveTime', () => {
  it('제한 시간 − 남은 시간을 정수 ms로 (소수는 버린다)', () => {
    expect(moveTime(60000, 60000)).toBe(0);
    expect(moveTime(60000, 45230.7)).toBe(14769);
    expect(moveTime(60000, 1)).toBe(59999);
  });

  it('범위를 벗어나는 값은 0 ~ 제한 시간−1로 맞춘다', () => {
    expect(moveTime(60000, 61000)).toBe(0);
    expect(moveTime(60000, 0)).toBe(59999);
    expect(moveTime(15000, 0.2)).toBe(14999);
  });
});

describe('MoveLog', () => {
  const a = { r: 1, c: 2 };
  const b = { r: 1, c: 3 };

  it('기록한 순서대로 from/to/t를 돌려준다 (무효 스왑도 같은 방식으로 들어간다)', () => {
    const log = new MoveLog();
    log.record(a, b, 60000, 59000);
    log.record(b, a, 60000, 55000.5);
    expect(log.entries()).toEqual([
      { from: a, to: b, t: 1000 },
      { from: b, to: a, t: 4999 },
    ]);
  });

  it('아무것도 부르지 않으면 비어 있다 (busy로 막힌 입력은 record를 부르지 않는다)', () => {
    expect(new MoveLog().entries()).toEqual([]);
  });

  it('entries()를 고쳐도 기록은 그대로다', () => {
    const log = new MoveLog();
    log.record(a, b, 60000, 60000);
    (log.entries()[0]!.from as { r: number }).r = 99;
    expect(log.entries()[0]!.from.r).toBe(1);
  });

  it('record에 넘긴 좌표 객체를 나중에 고쳐도 기록은 그대로다', () => {
    const log = new MoveLog();
    const from = { r: 0, c: 0 } as { r: number; c: number };
    log.record(from, b, 60000, 60000);
    from.r = 7;
    expect(log.entries()[0]!.from.r).toBe(0);
  });
});
