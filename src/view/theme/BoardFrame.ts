// 웨이퍼 과자 모양 보드판 테두리. 안쪽 크림색 바탕은 BoardView가 VIEW.boardBackground로 그린다.

import Phaser from 'phaser';
import { DECOR, THEME } from '../../config';
import type { Layout } from '../layout';

export function drawBoardFrame(scene: Phaser.Scene, layout: Layout): void {
  const { pad, radius, border, grainLines, grainAlpha } = DECOR.frame;
  const x = layout.x - pad;
  const y = layout.y - pad;
  const w = layout.width + pad * 2;
  const h = layout.height + pad * 2;

  const g = scene.add.graphics();
  g.fillStyle(THEME.wafer.fill, 1).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(border, THEME.wafer.stroke, 1).strokeRoundedRect(x, y, w, h, radius);

  // 가로 결: 테두리 띠 위쪽과 아래쪽에 나눠 긋는다
  g.lineStyle(2, THEME.wafer.grain, grainAlpha);
  for (let i = 0; i < grainLines; i++) {
    const gy = i < grainLines / 2 ? y + 3 + i * 3 : y + h - 3 - (grainLines - 1 - i) * 3;
    g.lineBetween(x + radius, gy, x + w - radius, gy);
  }
}
