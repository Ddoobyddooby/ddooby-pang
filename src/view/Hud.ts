// 상단 HUD: 타이틀 + 정보 알약. 글자가 바뀌면 알약 폭을 다시 맞춘다.

import Phaser from 'phaser';
import { GAME, HUD, THEME } from '../config';

export class Hud {
  private readonly pill: Phaser.GameObjects.Graphics;
  private readonly info: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, title: string) {
    const cx = GAME.width / 2;
    scene.add
      .text(cx, HUD.title.y, title, {
        fontFamily: THEME.font,
        fontSize: `${HUD.title.fontSize}px`,
        color: THEME.title.fill,
        stroke: THEME.title.stroke,
        strokeThickness: HUD.title.strokeThickness,
      })
      .setOrigin(0.5);

    this.pill = scene.add.graphics();
    this.info = scene.add
      .text(cx, HUD.info.y, '', {
        fontFamily: THEME.font,
        fontSize: `${HUD.info.fontSize}px`,
        color: THEME.info.text,
      })
      .setOrigin(0.5);
  }

  setInfo(text: string): void {
    this.info.setText(text);
    const w = this.info.width + HUD.info.padX;
    const h = HUD.info.height;
    this.pill
      .clear()
      .fillStyle(THEME.info.bg, THEME.info.bgAlpha)
      .fillRoundedRect(this.info.x - w / 2, this.info.y - h / 2, w, h, h / 2);
  }
}
