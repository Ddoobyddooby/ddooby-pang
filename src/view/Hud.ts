// 화면 글자 틀: 위쪽 타이틀 + 보드 아래 정보 패널 테두리 (+ DEV seed).
// 패널 안쪽 내용은 모드마다 다르다: TimePanel(타임어택), StoryPanel(스토리).

import Phaser from 'phaser';
import { GAME, HUD, THEME } from '../config';
import type { ScreenLayout } from './layout';
import { drawPanelFrame } from './theme/BoardFrame';

export class Hud {
  constructor(
    private readonly scene: Phaser.Scene,
    title: string,
    private readonly screen: ScreenLayout,
  ) {
    scene.add
      .text(GAME.width / 2, screen.titleY, title, {
        fontFamily: THEME.font,
        fontSize: `${HUD.title.fontSize}px`,
        color: THEME.title.fill,
        stroke: THEME.title.stroke,
        strokeThickness: HUD.title.strokeThickness,
      })
      .setOrigin(0.5);
    drawPanelFrame(scene, screen.panel);
  }

  /** 개발 모드에서만 패널 구석에 작게 보여 준다 */
  setSeed(seed: number): void {
    const { panel } = this.screen;
    const { fontSize, inset } = HUD.panel.seed;
    this.scene.add
      .text(panel.x + panel.w - inset, panel.y + panel.h - inset, `seed ${seed}`, {
        fontFamily: THEME.font,
        fontSize: `${fontSize}px`,
        color: THEME.info.text,
      })
      .setOrigin(1, 1)
      .setAlpha(0.6);
  }
}
