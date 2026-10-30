// 바닥 장식: 분홍·크림 언덕 두 겹 + 막대사탕 + 컵케이크. 코드로 그려 텍스처로 한 번 굽는다.
// 화면 맨 아래에 붙고 보드·패널 뒤(구름·별 위)에 깔린다.

import type Phaser from 'phaser';
import { GAME, THEME, VIEW } from '../../config';

const DEPTH = -90;

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** 화면 맨 아래에 언덕을 놓는다. screenWidth는 EXPAND로 넓어진 화면 폭 */
export function addHills(scene: Phaser.Scene, screenWidth: number, screenHeight: number): void {
  const w = Math.ceil(Math.max(screenWidth, GAME.width));
  const h = VIEW.screen.decorH;
  const key = `hills-${w}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) throw new Error(`텍스처 ${key}를 만들지 못했다`);
    drawHills(tex.getContext(), w, h);
    tex.refresh();
  }
  // 넓어진 폭은 카메라가 가운데 맞춤으로 밀어 두므로, 그 왼쪽 끝에서 시작한다
  const left = (GAME.width - w) / 2;
  scene.add.image(left, screenHeight, key).setOrigin(0, 1).setDepth(DEPTH);
}

function drawHills(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const c = THEME.hills;
  const mid = (w - GAME.width) / 2; // 720 기준 좌표의 x 시작점

  ctx.fillStyle = css(c.back);
  ctx.beginPath();
  ctx.moveTo(0, 70);
  ctx.quadraticCurveTo(w * 0.2, 10, w * 0.4, 60);
  ctx.quadraticCurveTo(w * 0.6, 100, w * 0.8, 50);
  ctx.quadraticCurveTo(w * 0.92, 30, w, 55);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  ctx.fillStyle = css(c.front);
  ctx.beginPath();
  ctx.moveTo(0, 120);
  ctx.quadraticCurveTo(w * 0.25, 85, w * 0.5, 118);
  ctx.quadraticCurveTo(w * 0.78, 150, w, 110);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  lollipop(ctx, mid + 120, 78, 20, css(c.candy[0]!), css(c.stick));
  lollipop(ctx, mid + 590, 62, 24, css(c.candy[1]!), css(c.stick));
  cupcake(ctx, mid + 360, 128);
}

function lollipop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  candy: string,
  stick: string,
): void {
  ctx.fillStyle = stick;
  ctx.fillRect(x - 5, y, 10, r * 3.2);
  ctx.fillStyle = candy;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; // 소용돌이 한 줄
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0.3, Math.PI * 1.6);
  ctx.stroke();
}

function cupcake(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const c = THEME.hills;
  ctx.fillStyle = css(c.cupWrap);
  ctx.beginPath();
  ctx.moveTo(x - 42, y);
  ctx.lineTo(x + 42, y);
  ctx.lineTo(x + 32, y + 60);
  ctx.lineTo(x - 32, y + 60);
  ctx.fill();
  ctx.fillStyle = css(c.cupFrosting);
  ctx.beginPath();
  ctx.arc(x, y - 6, 40, Math.PI, 0);
  ctx.lineTo(x + 42, y);
  ctx.lineTo(x - 42, y);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 36, 22, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = css(c.cherry);
  ctx.beginPath();
  ctx.arc(x, y - 66, 10, 0, Math.PI * 2);
  ctx.fill();
}
