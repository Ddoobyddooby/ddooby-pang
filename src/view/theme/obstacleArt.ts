// 장애물 그림 (PLAN2 5.5): 자물쇠, 얼음 덩어리(1~3겹), 젤리(1~2겹), 조각.
// 우선 코드로 그려 텍스처로 굽는다. 나중에 Codex 그림으로 바꿀 때 이 파일의 draw* 함수와 키만 바꾸면 된다
// (BoardView·ObstacleView·미션 아이콘은 키로만 쓴다). 크기·연출 시간은 config.ts OBSTACLE.
// 판 바탕이 모든 테마에서 크림이라 자물쇠·얼음은 테마와 무관하고, 젤리만 themes.ts OBSTACLE_COLORS를 쓴다.

import type Phaser from 'phaser';
import { OBSTACLE } from '../../config';
import type { ObstacleKind } from '../../core/types';
import { getActiveThemeId, OBSTACLE_COLORS, type ThemeId } from './themes';

type Ctx = CanvasRenderingContext2D;

export const SHARD_KEY = 'obs-shard';
export const LOCK_KEY = 'obs-lock';

export function frostKey(hp: number): string {
  return `obs-frost-${Math.min(3, Math.max(1, hp))}`;
}

export function jellyKey(hp: number, theme: ThemeId = getActiveThemeId()): string {
  return `obs-jelly-${Math.min(2, Math.max(1, hp))}-${theme}`;
}

/** 미션 카드·패널 아이콘 (가장 진한 모양) */
export function obstacleIconKey(kind: ObstacleKind, theme: ThemeId = getActiveThemeId()): string {
  if (kind === 'lock') return LOCK_KEY;
  return kind === 'frost' ? frostKey(3) : jellyKey(2, theme);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 자물쇠: 블록 색이 보이게 칸 테두리 금빛 띠 + 오른쪽 아래의 작은 자물쇠 */
function drawLock(ctx: Ctx, s: number): void {
  const u = s / 128;
  ctx.save();
  ctx.scale(u, u);
  // 블록을 묶은 띠 (속이 비어 있다)
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#d9962b';
  roundRect(ctx, 11, 11, 106, 106, 24);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffe9a8';
  roundRect(ctx, 8, 8, 112, 112, 26);
  ctx.stroke();
  // 자물쇠 (오른쪽 아래)
  ctx.translate(88, 90);
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8b94a3';
  ctx.beginPath();
  ctx.arc(0, -8, 13, Math.PI, 0);
  ctx.lineTo(13, 0);
  ctx.moveTo(-13, -8);
  ctx.lineTo(-13, 0);
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, -2, 0, 28);
  grad.addColorStop(0, '#ffd45e');
  grad.addColorStop(1, '#e39a1e');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#9a5d0e';
  ctx.lineWidth = 3.5;
  roundRect(ctx, -22, -4, 44, 32, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a4608';
  ctx.beginPath();
  ctx.arc(0, 9, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-2, 10, 4, 10);
  ctx.restore();
}

/** 금: 겹수가 적을수록 많다 (좌표는 128 기준) */
const CRACKS: Record<number, number[][]> = {
  3: [[40, 8, 52, 34, 46, 52]],
  2: [
    [40, 8, 52, 34, 46, 52, 62, 70],
    [100, 22, 82, 40, 90, 60],
    [20, 96, 40, 84, 52, 100],
  ],
  1: [
    [40, 8, 52, 34, 46, 52, 62, 70, 56, 92, 70, 120],
    [100, 22, 82, 40, 90, 60, 72, 74],
    [8, 70, 30, 62, 44, 76],
    [20, 118, 40, 100, 52, 108],
    [120, 96, 98, 88, 90, 104],
  ],
};

/** 얼음 덩어리: 칸을 채운다. 겹이 많을수록 진하고 하얗고, 적을수록 투명하고 금이 많다 */
function drawFrost(ctx: Ctx, s: number, hp: number): void {
  const u = s / 128;
  ctx.save();
  ctx.scale(u, u);
  const alpha = [0, 0.78, 0.9, 0.97][hp]!;
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#f2fbff');
  grad.addColorStop(0.55, '#b7e4fa');
  grad.addColorStop(1, '#7cc4ec');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#4f9fd0';
  ctx.lineWidth = 5;
  roundRect(ctx, 4, 4, 120, 120, 20);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
  // 윗면 반짝임
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  roundRect(ctx, 16, 14, 62, 12, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(94, 22, 5, 0, Math.PI * 2);
  ctx.fill();
  // 겹 표시: 안쪽 면이 겹수만큼 (3겹이면 두 줄 안쪽 모서리)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  for (let i = 1; i < hp; i++) {
    roundRect(ctx, 4 + i * 11, 4 + i * 11, 120 - i * 22, 120 - i * 22, 14);
    ctx.stroke();
  }
  // 금
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of CRACKS[hp] ?? []) {
    for (const [color, width] of [
      ['#3f86b8', 5],
      ['#ffffff', 2.2],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(line[0]!, line[1]!);
      for (let i = 2; i < line.length; i += 2) ctx.lineTo(line[i]!, line[i + 1]!);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 젤리: 블록 밑 바닥. 2겹은 진하게, 1겹은 옅게. 윗면 반짝임 */
function drawJelly(ctx: Ctx, s: number, hp: number, color: string, edge: string): void {
  const u = s / 128;
  ctx.save();
  ctx.scale(u, u);
  ctx.globalAlpha = hp >= 2 ? 0.92 : 0.45;
  ctx.fillStyle = color;
  ctx.strokeStyle = edge;
  ctx.lineWidth = hp >= 2 ? 6 : 4;
  roundRect(ctx, 6, 6, 116, 116, 28);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = hp >= 2 ? 0.55 : 0.4;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 18, 16, 50, 11, 5.5);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, 22, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 조각: 흰색 마름모 (쓸 때 tint) */
function drawShard(ctx: Ctx, s: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.lineTo(s, s * 0.45);
  ctx.lineTo(s * 0.55, s);
  ctx.lineTo(0, s * 0.55);
  ctx.closePath();
  ctx.fill();
}

function bake(scene: Phaser.Scene, key: string, size: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return; // 씬 재시작 대비
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) throw new Error(`텍스처 ${key}를 만들지 못했다`);
  draw(tex.getContext());
  tex.refresh();
}

/** 장애물 텍스처를 굽는다 (자물쇠·얼음 3장·조각은 공통, 젤리는 테마별). 이미 있으면 건너뛴다 */
export function ensureObstacleTextures(
  scene: Phaser.Scene,
  theme: ThemeId = getActiveThemeId(),
): void {
  const size = OBSTACLE.texSize;
  bake(scene, LOCK_KEY, size, (ctx) => drawLock(ctx, size));
  for (const hp of [1, 2, 3]) bake(scene, frostKey(hp), size, (ctx) => drawFrost(ctx, size, hp));
  bake(scene, SHARD_KEY, 32, (ctx) => drawShard(ctx, 32));
  const { jelly, jellyEdge } = OBSTACLE_COLORS[theme];
  for (const hp of [1, 2]) {
    bake(scene, jellyKey(hp, theme), size, (ctx) => drawJelly(ctx, size, hp, jelly, jellyEdge));
  }
}
