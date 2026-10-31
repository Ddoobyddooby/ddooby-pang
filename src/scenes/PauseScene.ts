// 일시정지 창 (PLAN 6.6). GameScene 위에 띄우고(launch) GameScene은 멈춘다(pause).
// 반투명 덮개가 아래 입력을 삼킨다. 나가기·다시하기는 결과가 아니므로 저장하지 않는다.

import Phaser from 'phaser';
import { GAME, PAUSE, THEME, VIEW } from '../config';
import { addButton, type PressLock } from '../view/ui/Button';
import { drawCreamPanel } from '../view/ui/Panel';
import { addSceneMuteButton } from './muteToggle';
import { pauseButtons, type PauseButton } from './pauseRules';
import type { GameData, PauseData } from './sceneData';

export class PauseScene extends Phaser.Scene {
  private from: GameData = { mode: 'timeattack' };

  constructor() {
    super('Pause');
  }

  init(data?: PauseData): void {
    this.from = data?.from ?? { mode: 'timeattack' };
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    const cx = GAME.width / 2;
    const cy = height / 2;

    // 화면 전체 덮개: 눌러도 아무 일 없고, 아래 게임으로 입력이 가지 않는다
    this.add
      .rectangle(cx, height / 2, width, height, PAUSE.dim.color, PAUSE.dim.alpha)
      .setInteractive();

    const buttons = pauseButtons(this.from);
    const b = PAUSE.button;
    const lastButtonY = cy + b.dy + (buttons.length - 1) * b.step;
    drawCreamPanel(
      this,
      cx,
      cy + PAUSE.title.dy - PAUSE.panel.padTop,
      lastButtonY + b.height / 2 + PAUSE.panel.padBottom,
      PAUSE.panel,
    );
    this.add
      .text(cx, cy + PAUSE.title.dy, PAUSE.title.text, {
        fontFamily: THEME.font,
        fontSize: `${PAUSE.title.fontSize}px`,
        color: THEME.title.fill,
        stroke: THEME.title.stroke,
        strokeThickness: PAUSE.title.strokeThickness,
      })
      .setOrigin(0.5);

    const lock: PressLock = { pressed: false };
    buttons.forEach((id, i) => {
      addButton(
        this,
        cx,
        cy + b.dy + i * b.step,
        { ...b, label: PAUSE.buttons[id] },
        () => this.go(id),
        lock,
      );
    });
    // 게임 화면의 ❚❚ 자리에 음소거 버튼
    addSceneMuteButton(this, VIEW.screen.titleY);
  }

  private go(button: PauseButton): void {
    switch (button) {
      case 'resume':
        this.scene.resume('Game');
        this.scene.stop();
        break;
      case 'retry':
        this.scene.start('Game', this.from); // 멈춘 Game을 처음부터 다시, 이 씬은 끝난다
        break;
      case 'map':
      case 'menu':
        this.scene.stop('Game');
        this.scene.start(button === 'map' ? 'StageMap' : 'Menu');
        break;
    }
  }
}
