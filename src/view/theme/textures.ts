// 블록·특수 표시·파티클 텍스처를 시작할 때 한 번 그려 둔다 (스펙 4.2).
// 모양과 얼굴 좌표는 시안(docs/superpowers/specs/mocks/block-style.html B안, cascade-fx.html)을 옮긴 것이다.
// 시안 좌표(-50~50)를 텍스처(0~TEX_SIZE)로 맞춰 그리고, 화면에서는 칸 크기로 줄여 쓴다.

import type Phaser from 'phaser';
import { THEME } from '../../config';
import type { Color, SpecialKind } from '../../core/types';

export type Face = 'normal' | 'squint' | 'happy';

/** 텍스처 한 변(px). 칸(85px)보다 크게 그려 줄여 쓰면 고해상도에서도 흐려지지 않는다 */
export const TEX_SIZE = 160;
const FX_TEX_SIZE = 64;
const FACES: readonly Face[] = ['normal', 'squint', 'happy'];
const SPECIALS: readonly Exclude<SpecialKind, 'color'>[] = ['lineH', 'lineV', 'bomb', 'super'];

export const FX_TEX = { heart: 'fx-heart', star: 'fx-star' } as const;

export function blockKey(color: Color | null, face: Face): string {
  return `block-${color ?? 'rainbow'}-${face}`;
}

export function specialKey(kind: Exclude<SpecialKind, 'color'>): string {
  return `special-${kind}`;
}

/** 시안 s0~s5 (모두 -50~50 안). 둥근 사각형·삼각형은 시안의 곡선 그대로 */
const SHAPES: readonly string[] = [
  'M0,-40 a40,40 0 1,1 -0.1,0z',
  'M-22,-38 h44 a16,16 0 0 1 16,16 v44 a16,16 0 0 1 -16,16 h-44 a16,16 0 0 1 -16,-16 v-44 a16,16 0 0 1 16,-16z',
  'M0,-44 L40,0 L0,44 L-40,0 Z',
  'M0,-40 Q8,-40 40,30 Q42,38 32,38 L-32,38 Q-42,38 -40,30 Q-8,-40 0,-40 Z',
  'M0,-42 L36,-21 L36,21 L0,42 L-36,21 L-36,-21 Z',
  'M0,-44 L12,-14 L43,-13 L18,7 L27,38 L0,20 L-27,38 L-18,7 L-43,-13 L-12,-14 Z',
];

/** 색마다 다른 하이라이트 (시안 f0~f5). 얼굴이 큰 모양(초록·파랑·주황)은 하이라이트가 없다 */
const HIGHLIGHTS: readonly (
  readonly [cx: number, cy: number, rx: number, ry: number, a: number] | null
)[] = [[-14, -24, 12, 5, 0.55], [-14, -25, 12, 5, 0.6], null, null, [-12, -24, 10, 4, 0.55], null];

/** 색마다 얼굴 위치·크기 (시안 f2·f3·f5: 모양 가운데가 비어 보이지 않게 내리고 줄인다) */
const FACE_PLACE: readonly { dy: number; scale: number }[] = [
  { dy: 0, scale: 1 },
  { dy: 0, scale: 1 },
  { dy: 4, scale: 0.85 },
  { dy: 14, scale: 0.85 },
  { dy: 0, scale: 1 },
  { dy: 4, scale: 0.72 },
];

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

type Ctx = CanvasRenderingContext2D;

/** 시안 좌표계(-50~50, 원점 가운데)로 그리도록 맞춘 컨텍스트에서 draw를 실행한다 */
function withMockSpace(ctx: Ctx, size: number, draw: () => void): void {
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 100, size / 100);
  draw();
  ctx.restore();
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

function drawFace(ctx: Ctx, face: Face): void {
  const ink = css(THEME.face.ink);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (face === 'normal') {
    for (const x of [-11, 11]) {
      ellipse(ctx, x, -2, 4.5, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (const x of [-9.5, 12.5]) {
      ctx.beginPath();
      ctx.arc(x, -4.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 2.6;
    ctx.stroke(new Path2D('M-5,8 q5,5 10,0'));
  } else if (face === 'squint') {
    ctx.lineWidth = 3;
    ctx.stroke(new Path2D('M-16,-7 l7,5 -7,5 M16,-7 l-7,5 7,5'));
  } else {
    ctx.lineWidth = 3;
    ctx.stroke(new Path2D('M-16,0 q5,-8 10,0 M6,0 q5,-8 10,0'));
  }

  ctx.fillStyle = css(THEME.face.cheek);
  ctx.globalAlpha = 0.55;
  for (const x of [-21, 21]) {
    ellipse(ctx, x, 8, 6, 3.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = ink;
  if (face === 'squint') {
    ellipse(ctx, 0, 10, 5, 4);
    ctx.fill();
  } else if (face === 'happy') {
    ctx.fill(new Path2D('M-8,6 q8,10 16,0 z'));
  }
}

function drawBlock(ctx: Ctx, color: Color | null, face: Face): void {
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';

  if (color === null) {
    // 컬러 블록: 무지개 조각 원
    THEME.blocks.forEach((b, i) => {
      ctx.fillStyle = css(b.fill);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 40, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    });
    ctx.strokeStyle = css(THEME.blocks[4].stroke);
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
    drawFace(ctx, face);
    return;
  }

  const shape = new Path2D(SHAPES[color]);
  ctx.fillStyle = css(THEME.blocks[color].fill);
  ctx.strokeStyle = css(THEME.blocks[color].stroke);
  ctx.fill(shape);
  ctx.stroke(shape);

  const hl = HIGHLIGHTS[color];
  if (hl) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = hl[4];
    ellipse(ctx, hl[0], hl[1], hl[2], hl[3]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const place = FACE_PLACE[color]!;
  ctx.save();
  ctx.translate(0, place.dy);
  ctx.scale(place.scale, place.scale);
  drawFace(ctx, face);
  ctx.restore();
}

/** 블록 하나를 size×size 캔버스 가운데에 그린다 (Phaser 없이). 앱 아이콘(dev/appIcon.ts)이 같은 그림을 쓰도록 */
export function drawBlockOnCanvas(ctx: Ctx, size: number, color: Color | null, face: Face): void {
  withMockSpace(ctx, size, () => drawBlock(ctx, color, face));
}

/** 특수 블록 배지 위치·크기 (시안 좌표). 모양이 6가지라 줄무늬 대신 오른쪽 위 배지로 표시한다 */
const BADGE = { x: 27, y: -27, r: 19 };

/** 특수 블록 표시: 블록 위에 겹치는 흰 배지 + 종류 아이콘 (↔ ↕ 폭탄 별) */
function drawSpecial(ctx: Ctx, kind: Exclude<SpecialKind, 'color'>): void {
  const ink = css(THEME.face.ink);
  ctx.translate(BADGE.x, BADGE.y);
  ctx.beginPath();
  ctx.arc(0, 0, BADGE.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'lineH' || kind === 'lineV') {
    if (kind === 'lineV') ctx.rotate(Math.PI / 2);
    ctx.lineWidth = 4;
    ctx.stroke(new Path2D('M-11,0 H11 M-5,-6 L-11,0 L-5,6 M5,-6 L11,0 L5,6'));
  } else if (kind === 'bomb') {
    ctx.beginPath();
    ctx.arc(-2, 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke(new Path2D('M4,-4 q4,-6 8,-6'));
    ctx.fillStyle = css(THEME.face.cheek);
    ctx.beginPath();
    ctx.arc(12, -10, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const star = new Path2D('M0,-13 L4,-4 13,-4 6,2 9,12 0,6 -9,12 -6,2 -13,-4 -4,-4Z');
    ctx.fillStyle = css(THEME.star);
    ctx.fill(star);
    ctx.lineWidth = 2.5;
    ctx.stroke(star);
  }
}

/** 하트·별 파티클. 흰색으로 그려 두고 쓸 때 tint한다. 시안 #heart·#star를 키워서 옮겼다 */
function drawFxTexture(ctx: Ctx, path: string): void {
  ctx.fillStyle = '#ffffff';
  ctx.fill(new Path2D(path));
}

function bake(scene: Phaser.Scene, key: string, size: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return; // 씬 재시작 대비
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) throw new Error(`텍스처 ${key}를 만들지 못했다`);
  const ctx = tex.getContext();
  withMockSpace(ctx, size, () => draw(ctx));
  tex.refresh();
}

export function ensureTextures(scene: Phaser.Scene): void {
  const colors: (Color | null)[] = [0, 1, 2, 3, 4, 5, null];
  for (const color of colors) {
    for (const face of FACES) {
      bake(scene, blockKey(color, face), TEX_SIZE, (ctx) => drawBlock(ctx, color, face));
    }
  }
  for (const kind of SPECIALS) {
    bake(scene, specialKey(kind), TEX_SIZE, (ctx) => drawSpecial(ctx, kind));
  }
  // 파티클 시안은 -10~10 정도의 작은 모양이라 시안 좌표계 안에서 한 번 더 키운다
  bake(scene, FX_TEX.heart, FX_TEX_SIZE, (ctx) => {
    ctx.scale(5, 5);
    drawFxTexture(
      ctx,
      'M0,6 C-10,-2 -8,-10 -3,-10 C-1,-10 0,-8 0,-7 C0,-8 1,-10 3,-10 C8,-10 10,-2 0,6Z',
    );
  });
  bake(scene, FX_TEX.star, FX_TEX_SIZE, (ctx) => {
    ctx.scale(6.4, 6.4);
    drawFxTexture(ctx, 'M0,-7 L2,-2 7,-2 3,1 5,6 0,3 -5,6 -3,1 -7,-2 -2,-2Z');
  });
}
