import { describe, expect, it } from 'vitest';
import { createRng, next, nextInt, type RngState } from '../../src/core/rng';

/** 널리 쓰이는 클로저 방식 mulberry32 원본. 순수 함수 버전과 결과가 같아야 한다 */
function referenceMulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function take(seed: number, count: number): number[] {
  let s: RngState = createRng(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let v: number;
    [v, s] = next(s);
    out.push(v);
  }
  return out;
}

describe('core/rng', () => {
  it('같은 seed → 같은 수열', () => {
    expect(take(1001, 100)).toEqual(take(1001, 100));
  });

  it('다른 seed → 다른 수열', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it('원본 mulberry32와 같은 값을 낸다', () => {
    for (const seed of [0, 1, 1001, -5, 2 ** 31 - 1]) {
      const ref = referenceMulberry32(seed);
      const expected = Array.from({ length: 20 }, ref);
      expect(take(seed, 20)).toEqual(expected);
    }
  });

  it('순수 함수: 같은 상태로 다시 부르면 같은 결과', () => {
    const s = createRng(42);
    expect(next(s)).toEqual(next(s));
  });

  it('값은 [0, 1) 범위', () => {
    for (const v of take(7, 10_000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt는 [0, n) 정수이고 모든 값이 고르게 나온다', () => {
    const n = 6;
    const counts = new Array<number>(n).fill(0);
    let s = createRng(123);
    const trials = 60_000;
    for (let i = 0; i < trials; i++) {
      let v: number;
      [v, s] = nextInt(s, n);
      expect(Number.isInteger(v)).toBe(true);
      counts[v]!++;
    }
    // 각 값의 기대 횟수 10000. ±5% 이내면 충분히 고르다
    for (const c of counts) {
      expect(c).toBeGreaterThan(9_500);
      expect(c).toBeLessThan(10_500);
    }
  });
});
