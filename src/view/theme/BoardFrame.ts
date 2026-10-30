// 웨이퍼 과자 모양 테두리. 보드판의 안쪽 크림색 바탕은 BoardView가 VIEW.boardBackground로 그린다.
// 정보 패널도 같은 모양을 쓰고 안쪽 바탕까지 여기서 그린다.

import Phaser from 'phaser';
import { DECOR, THEME, VIEW } from '../../config';
import type { Layout } from '../layout';

export function drawBoardFrame(scene: Phaser.Scene, layout: Layout): void {
  const { pad } = DECOR.frame;
  drawWafer(scene, layout.x - pad, layout.y - pad, layout.width + pad * 2, layout.height + pad * 2);
}

/** 정보 패널: 웨이퍼 테두리 + 안쪽 크림 바탕 */
export function drawPanelFrame(
  scene: Phaser.Scene,
  { x, y, w, h }: { x: number; y: number; w: number; h: number },
): void {
  const { pad, radius } = DECOR.frame;
  drawWafer(scene, x, y, w, h);
  scene.add
    .graphics()
    .fillStyle(VIEW.boardBackground, 1)
    .fillRoundedRect(x + pad, y + pad, w - pad * 2, h - pad * 2, radius / 2);
}

function drawWafer(scene: Phaser.Scene, x: number, y: number, w: number, h: number): void {
  const { radius, border, grainLines, grainAlpha } = DECOR.frame;
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
