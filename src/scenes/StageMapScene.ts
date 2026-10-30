// 스테이지 지도 자리 (W3-09에서 사탕 길과 노드를 채운다). 지금은 제목과 [←]만 있다.

import Phaser from 'phaser';
import { GAME, MENU, THEME } from '../config';
import { addButton } from '../view/ui/Button';
import { Background } from '../view/theme/Background';

export class StageMapScene extends Phaser.Scene {
  constructor() {
    super('StageMap');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0);
    new Background(this);
    this.add
      .text(GAME.width / 2, height / 2, '스토리', {
        fontFamily: THEME.font,
        fontSize: `${MENU.title.fontSize}px`,
        color: THEME.title.fill,
      })
      .setOrigin(0.5);
    addButton(this, GAME.width / 2, height / 2 + 160, { ...MENU.button, label: '메뉴' }, () =>
      this.scene.start('Menu'),
    );
  }
}
