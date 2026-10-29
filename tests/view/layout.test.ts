import { describe, expect, it } from 'vitest';
import { cellAt, cellCenter, createLayout } from '../../src/view/layout';

const AREA = { x: 20, y: 200, size: 680 };

describe('view/layout', () => {
  it('8x8: 칸 85px, 보드가 영역을 꽉 채운다', () => {
    const l = createLayout(8, 8, AREA);
    expect(l).toEqual({ rows: 8, cols: 8, cell: 85, x: 20, y: 200, width: 680, height: 680 });
  });

  it('정사각형이 아니면 가운데 정렬', () => {
    const l = createLayout(5, 8, AREA);
    expect(l.cell).toBe(85);
    expect(l.height).toBe(425);
    expect(l.y).toBe(200 + (680 - 425) / 2);
  });

  it('cellCenter: 칸 중심, 음수 행은 보드 위', () => {
    const l = createLayout(8, 8, AREA);
    expect(cellCenter(l, { r: 0, c: 0 })).toEqual({ x: 62.5, y: 242.5 });
    expect(cellCenter(l, { r: 7, c: 7 })).toEqual({ x: 657.5, y: 837.5 });
    expect(cellCenter(l, { r: -1, c: 0 }).y).toBe(157.5);
  });

  it('cellAt: cellCenter의 역함수, 칸 경계와 보드 밖', () => {
    const l = createLayout(8, 8, AREA);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const { x, y } = cellCenter(l, { r, c });
        expect(cellAt(l, x, y)).toEqual({ r, c });
      }
    }
    expect(cellAt(l, 20, 200)).toEqual({ r: 0, c: 0 }); // 왼쪽 위 모서리
    expect(cellAt(l, 104.9, 200)).toEqual({ r: 0, c: 0 });
    expect(cellAt(l, 105, 200)).toEqual({ r: 0, c: 1 });
    expect(cellAt(l, 19, 300)).toBeNull();
    expect(cellAt(l, 300, 880)).toBeNull(); // 보드 아래
  });
});
