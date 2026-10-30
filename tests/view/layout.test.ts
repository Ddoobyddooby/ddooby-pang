import { describe, expect, it } from 'vitest';
import { cellAt, cellCenter, createLayout, screenLayout } from '../../src/view/layout';

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

describe('screenLayout', () => {
  it('기준 1280: 타이틀 90, 보드 170(680), 패널 870(높이 170), 장식은 아래 220px', () => {
    expect(screenLayout(1280)).toEqual({
      titleY: 90,
      board: { x: 20, y: 170, size: 680 },
      panel: { x: 10, y: 870, w: 700, h: 170 },
      decorY: 1060,
    });
  });

  it('1558(390x844): 늘어난 278의 30%는 보드 위, 70%는 패널~장식 사이', () => {
    const base = screenLayout(1280);
    const l = screenLayout(1558);
    const extra = 1558 - 1280;
    expect(l.titleY).toBe(base.titleY);
    expect(l.board.y).toBeCloseTo(170 + 0.3 * extra);
    expect(l.panel.y).toBeCloseTo(l.board.y + 700); // 보드 바로 아래 (기준과 같은 간격)
    expect(l.decorY).toBe(1558 - 220); // 화면 아래에 붙는다
    const gap = l.decorY - (l.panel.y + l.panel.h);
    expect(gap).toBeCloseTo(base.decorY - (base.panel.y + base.panel.h) + 0.7 * extra);
  });

  it('1280보다 짧으면 1280과 같다', () => {
    expect(screenLayout(1000)).toEqual(screenLayout(1280));
  });
});
