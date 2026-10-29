// 블록 하나의 그림. 색마다 모양도 다르게 그려 색을 구분하기 어려워도 알아볼 수 있게 한다.
// 특수 블록 표시는 임시 (W2-07에서 다듬는다).

import Phaser from 'phaser';
import { VIEW } from '../config';
import type { Block } from '../core/types';

const RAINBOW = [0xff5a5f, 0xff8c42, 0xffd23f, 0x3ecf8e, 0x4d96ff, 0x9b5de5];

function regularPolygon(sides: number, radius: number, rotation = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, i) => {
    const a = rotation + (i / sides) * Math.PI * 2;
    return new Phaser.Geom.Point(Math.cos(a) * radius, Math.sin(a) * radius);
  });
}

function star(points: number, outer: number, inner: number) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? outer : inner;
    return new Phaser.Geom.Point(Math.cos(a) * radius, Math.sin(a) * radius);
  });
}

/** 색 번호별 모양: 원, 둥근 사각형, 다이아몬드, 삼각형, 육각형, 별 */
function drawShape(g: Phaser.GameObjects.Graphics, color: number, s: number): void {
  const h = s / 2;
  switch (color) {
    case 0:
      g.fillCircle(0, 0, h);
      break;
    case 1:
      g.fillRoundedRect(-h * 0.9, -h * 0.9, s * 0.9, s * 0.9, s * 0.18);
      break;
    case 2:
      g.fillPoints(regularPolygon(4, h), true);
      break;
    case 3:
      g.fillPoints(regularPolygon(3, h * 1.1, -Math.PI / 2), true);
      break;
    case 4:
      g.fillPoints(regularPolygon(6, h), true);
      break;
    default:
      g.fillPoints(star(5, h * 1.05, h * 0.5), true);
  }
}

export class BlockSprite extends Phaser.GameObjects.Container {
  readonly blockId: number;

  constructor(scene: Phaser.Scene, x: number, y: number, block: Block, cellSize: number) {
    super(scene, x, y);
    this.blockId = block.id;
    const size = cellSize * VIEW.blockScale;
    const g = scene.add.graphics();

    if (block.special === 'color' || block.color === null) {
      // 컬러 블록: 무지개 조각 원
      RAINBOW.forEach((tint, i) => {
        g.fillStyle(tint, 1);
        g.slice(0, 0, size / 2, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2, false);
        g.fillPath();
      });
    } else {
      g.fillStyle(VIEW.blockColors[block.color]!, 1);
      drawShape(g, block.color, size);
      // 위쪽 하이라이트로 입체감
      g.fillStyle(0xffffff, 0.25);
      g.fillEllipse(-size * 0.12, -size * 0.2, size * 0.36, size * 0.18);
    }

    this.add(g);
    if (block.special && block.special !== 'color')
      this.add(this.specialMark(scene, block.special, size));
    scene.add.existing(this);
  }

  private specialMark(scene: Phaser.Scene, special: string, size: number) {
    const m = scene.add.graphics();
    m.lineStyle(size * 0.08, 0xffffff, 0.95);
    if (special === 'lineH') m.lineBetween(-size * 0.4, 0, size * 0.4, 0);
    else if (special === 'lineV') m.lineBetween(0, -size * 0.4, 0, size * 0.4);
    else if (special === 'bomb') m.strokeCircle(0, 0, size * 0.25);
    else m.strokeRect(-size * 0.25, -size * 0.25, size * 0.5, size * 0.5); // super
    return m;
  }
}
