// 솜사탕 하늘 배경: 세로 그라데이션 + 천천히 움직이는 구름 + 반짝이는 별. 깊이는 가장 아래.

import Phaser from 'phaser';
import { DECOR, GAME, THEME } from '../../config';

const DEPTH = -100;

export class Background {
  constructor(private readonly scene: Phaser.Scene) {
    this.drawSky();
    DECOR.clouds.forEach((c) => this.addCloud(c));
    DECOR.stars.forEach((s, i) => this.addStar(s.x, s.y, i));
  }

  private drawSky(): void {
    const { top, bottom } = THEME.sky;
    this.scene.add
      .graphics()
      .setDepth(DEPTH)
      .fillGradientStyle(top, top, bottom, bottom, 1)
      .fillRect(0, 0, GAME.width, GAME.height);
  }

  private addCloud(c: (typeof DECOR.clouds)[number]): void {
    const cloud = this.scene.add.container(c.x, c.y).setDepth(DEPTH + 1).setAlpha(DECOR.cloudAlpha);
    const puffs: [number, number, number, number][] = [
      [-50, 8, 90, 50],
      [0, -8, 110, 64],
      [50, 10, 84, 46],
    ];
    puffs.forEach(([x, y, w, h]) => cloud.add(this.scene.add.ellipse(x, y, w, h, THEME.cloud)));
    cloud.setScale(c.scale);
    this.scene.tweens.add({
      targets: cloud,
      x: c.x + c.drift,
      duration: c.ms,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private addStar(x: number, y: number, index: number): void {
    const r = DECOR.starRadius;
    const star = this.scene.add
      .star(x, y, 5, r * 0.45, r, THEME.star)
      .setDepth(DEPTH + 1)
      .setAlpha(DECOR.twinkleAlpha.min);
    this.scene.tweens.add({
      targets: star,
      alpha: DECOR.twinkleAlpha.max,
      duration: DECOR.twinkleMs,
      delay: index * 250, // 시작을 엇갈리게
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
