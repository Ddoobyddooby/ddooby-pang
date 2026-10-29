import { describe, expect, it } from 'vitest';
import { swipeTarget } from '../../src/view/input';
import { createLayout } from '../../src/view/layout';

const layout = createLayout(8, 8, { x: 20, y: 200, size: 680 }); // 칸 85px → 문턱 25.5px
const mid = { r: 3, c: 3 };

describe('swipeTarget', () => {
  it('문턱(칸의 30%) 미만이면 아직 스왑하지 않는다', () => {
    expect(swipeTarget(layout, mid, 25, 0)).toBeNull();
    expect(swipeTarget(layout, mid, -10, 20)).toBeNull();
  });

  it('상하좌우', () => {
    expect(swipeTarget(layout, mid, 30, 0)).toEqual({ r: 3, c: 4 });
    expect(swipeTarget(layout, mid, -30, 0)).toEqual({ r: 3, c: 2 });
    expect(swipeTarget(layout, mid, 0, 30)).toEqual({ r: 4, c: 3 });
    expect(swipeTarget(layout, mid, 0, -30)).toEqual({ r: 2, c: 3 });
  });

  it('대각선으로 끌면 더 많이 움직인 방향, 같으면 가로', () => {
    expect(swipeTarget(layout, mid, 40, 30)).toEqual({ r: 3, c: 4 });
    expect(swipeTarget(layout, mid, -20, -40)).toEqual({ r: 2, c: 3 });
    expect(swipeTarget(layout, mid, 30, 30)).toEqual({ r: 3, c: 4 });
  });

  it('아무리 멀리 끌어도 한 칸만', () => {
    expect(swipeTarget(layout, mid, 500, 0)).toEqual({ r: 3, c: 4 });
  });

  it('보드 밖으로 밀면 null', () => {
    expect(swipeTarget(layout, { r: 0, c: 0 }, 0, -40)).toBeNull();
    expect(swipeTarget(layout, { r: 0, c: 0 }, -40, 0)).toBeNull();
    expect(swipeTarget(layout, { r: 7, c: 7 }, 40, 0)).toBeNull();
    expect(swipeTarget(layout, { r: 7, c: 7 }, 0, 40)).toBeNull();
  });
});
