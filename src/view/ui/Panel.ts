// 반투명 크림 판 + 웨이퍼 테두리 (BoardFrame과 같은 색·두께). 결과·일시정지 창이 같이 쓴다.

import type Phaser from 'phaser';
import { DECOR, THEME } from '../../config';

/** 가운데 cx, 위·아래 끝은 내용에 맞춘다 */
export function drawCreamPanel(
  scene: Phaser.Scene,
  cx: number,
  top: number,
  bottom: number,
  { width: w, alpha }: { width: number; alpha: number },
): Phaser.GameObjects.Graphics {
  const { radius, border } = DECOR.frame;
  return scene.add
    .graphics()
    .fillStyle(THEME.wafer.inner, alpha)
    .fillRoundedRect(cx - w / 2, top, w, bottom - top, radius)
    .lineStyle(border, THEME.wafer.stroke, 1)
    .strokeRoundedRect(cx - w / 2, top, w, bottom - top, radius);
}
