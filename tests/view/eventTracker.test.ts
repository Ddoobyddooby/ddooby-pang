import { describe, expect, it } from 'vitest';
import { EventTracker } from '../../src/view/eventTracker';
import { parseBoard } from '../helpers/board';

const board = parseBoard(`
  R Y
  G B
`); // id: R=1 Y=2 G=3 B=4

describe('view/EventTracker', () => {
  it('swap → 두 칸의 id가 바뀐다', () => {
    const t = new EventTracker(board);
    t.apply({ type: 'swap', a: { r: 0, c: 0 }, b: { r: 0, c: 1 } });
    expect(t.idAt({ r: 0, c: 0 })).toBe(2);
    expect(t.idAt({ r: 0, c: 1 })).toBe(1);
  });

  it('remove → fall → refill', () => {
    const t = new EventTracker(board);
    t.apply({ type: 'remove', blocks: [{ id: 3, at: { r: 1, c: 0 }, bySpecial: false }] });
    t.apply({ type: 'fall', moves: [{ id: 1, from: { r: 0, c: 0 }, to: { r: 1, c: 0 } }] });
    t.apply({
      type: 'refill',
      blocks: [{ block: { id: 5, color: 0 }, at: { r: 0, c: 0 }, dropFrom: 1 }],
    });
    expect([...t.snapshot()].sort()).toEqual([
      ['0,0', 5],
      ['0,1', 2],
      ['1,0', 1],
      ['1,1', 4],
    ]);
  });

  it('이벤트와 맞지 않으면 에러 (계약 위반)', () => {
    const t = new EventTracker(board);
    expect(() =>
      t.apply({ type: 'remove', blocks: [{ id: 99, at: { r: 0, c: 0 }, bySpecial: false }] }),
    ).toThrow('remove');
    expect(() =>
      t.apply({ type: 'fall', moves: [{ id: 1, from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }] }),
    ).toThrow('비어 있지 않다');
  });
});
