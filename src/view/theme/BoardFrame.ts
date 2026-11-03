// 웨이퍼 과자 모양 테두리. 보드판의 안쪽 크림색 바탕은 BoardView가 VIEW.boardBackground로 그린다.
// 정보 패널도 같은 모양을 쓰고 안쪽 바탕까지 여기서 그린다.

import type Phaser from 'phaser';
import { DECOR, THEME, VIEW } from '../../config';
import type { Layout } from '../layout';
import { scallopOutline } from './scallop';

export function drawBoardFrame(scene: Phaser.Scene, layout: Layout): void {
  const { pad } = DECOR.frame;
  drawWafer(
    scene,
    layout.x - pad,
    layout.y - pad,
    layout.width + pad * 2,
    layout.height + pad * 2,
    true,
  );
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

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** 웨이퍼 판: 둥근 사각형 + 대각선 격자(A안 그림책). 크기마다 캔버스 텍스처로 한 번 굽는다 */
function drawWafer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  wavy = false,
): void {
  const tw = Math.ceil(w);
  const th = Math.ceil(h);
  const key = `wafer-${wavy ? 'wave-' : ''}${tw}x${th}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, tw, th);
    if (!tex) throw new Error(`텍스처 ${key}를 만들지 못했다`);
    bakeWafer(tex.getContext(), tw, th, wavy);
    tex.refresh();
  }
  scene.add.image(x, y, key).setOrigin(0);
}

function bakeWafer(ctx: CanvasRenderingContext2D, w: number, h: number, wavy: boolean): void {
  const { radius, border, lattice, latticeWidth, latticeAlpha } = DECOR.frame;
  const half = border / 2; // 테두리 선이 캔버스 밖으로 잘리지 않게 안쪽으로
  const shape = (): void =>
    wavy
      ? wavePath(ctx, w, h, half)
      : roundRectPath(ctx, half, half, w - border, h - border, radius);
  shape();
  ctx.fillStyle = css(THEME.wafer.fill);
  ctx.fill();

  // 격자: 판 모양 안에서만 보이게 자른다. 안쪽은 보드·패널 바탕이 덮는다
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = css(THEME.wafer.grain);
  ctx.globalAlpha = latticeAlpha;
  ctx.lineWidth = latticeWidth;
  ctx.beginPath();
  for (let d = -h; d < w + h; d += lattice) {
    ctx.moveTo(d, 0);
    ctx.lineTo(d + h, h);
    ctx.moveTo(d + h, 0);
    ctx.lineTo(d, h);
  }
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = border;
  ctx.strokeStyle = css(THEME.wafer.stroke);
  shape();
  ctx.stroke();
}

/** 물결 윤곽(scallop.ts)을 캔버스 경로로 */
function wavePath(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number): void {
  ctx.beginPath();
  for (const c of scallopOutline(w, h, { ...DECOR.frame.wave, inset })) {
    if (c.op === 'M') ctx.moveTo(c.x, c.y);
    else ctx.quadraticCurveTo(c.cx, c.cy, c.x, c.y);
  }
  ctx.closePath();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
