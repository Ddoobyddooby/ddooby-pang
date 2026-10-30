// 메뉴 (스토리 화면 설계 2절, A안): 타이틀 + 통통 튀는 말랑 친구들 + 큰 웨이퍼 버튼 두 개.
// 버튼 안 진행 상황은 Boot가 읽어 둔 저장 데이터(saveRegistry)에서 가져온다.

import Phaser from 'phaser';
import { GAME, MENU, THEME } from '../config';
import type { Color } from '../core/types';
import { addButton, type PressLock } from '../view/ui/Button';
import { Background } from '../view/theme/Background';
import { addHills } from '../view/theme/Hills';
import { blockKey, ensureTextures } from '../view/theme/textures';
import { storyLabel, storyProgress, timeAttackLabel } from './menuText';
import { getSave } from './saveRegistry';
import type { GameData } from './sceneData';
import { getStages } from './stageRegistry';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    const cx = GAME.width / 2;
    const cy = height / 2;

    new Background(this);
    addHills(this, width, height);

    this.add
      .text(cx, cy + MENU.title.dy, MENU.title.text, {
        fontFamily: THEME.font,
        fontSize: `${MENU.title.fontSize}px`,
        color: THEME.title.fill,
        stroke: THEME.title.stroke,
        strokeThickness: MENU.title.strokeThickness,
      })
      .setOrigin(0.5);
    this.addFriends(cx, cy + MENU.friends.dy);

    const save = getSave(this.registry);
    const stageCount = getStages(this.registry).story.length;
    const lock: PressLock = { pressed: false };
    const spec = MENU.button;
    addButton(
      this,
      cx,
      cy + MENU.story.dy,
      { ...spec, label: MENU.story.text, sub: storyLabel(storyProgress(save, stageCount)) },
      () => this.scene.start('StageMap'),
      lock,
    );
    addButton(
      this,
      cx,
      cy + MENU.timeattack.dy,
      { ...spec, label: MENU.timeattack.text, sub: timeAttackLabel(save.timeattack.bestScore) },
      () => this.scene.start('Game', { mode: 'timeattack' } satisfies GameData),
      lock,
    );
  }

  /** 말랑 친구들 5개가 번갈아 통통 튄다 (블록 텍스처의 평소 얼굴) */
  private addFriends(cx: number, y: number): void {
    ensureTextures(this);
    const f = MENU.friends;
    const left = cx - ((f.colors.length - 1) * f.gap) / 2;
    f.colors.forEach((color, i) => {
      const friend = this.add
        .image(left + i * f.gap, y, blockKey(color as Color, 'normal'))
        .setDisplaySize(f.size, f.size);
      this.tweens.add({
        targets: friend,
        y: y - f.jump,
        duration: f.ms,
        delay: i * f.stagger,
        yoyo: true,
        repeat: -1,
        repeatDelay: (f.colors.length - 1) * f.stagger - f.ms,
        ease: 'Quad.easeOut',
      });
    });
  }
}
