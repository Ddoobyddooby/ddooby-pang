import { describe, expect, it } from 'vitest';

// W1-02: Vitest 동작 확인용. core 테스트가 생기면 지운다.
describe('sample', () => {
  it('1차원 보드 인덱스(r * cols + c)를 계산한다', () => {
    const cols = 8;
    const index = (r: number, c: number) => r * cols + c;

    expect(index(0, 0)).toBe(0);
    expect(index(1, 0)).toBe(8);
    expect(index(7, 7)).toBe(63);
  });
});
