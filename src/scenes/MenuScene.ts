// 메뉴 (스토리 화면 설계 2절, A안): 타이틀 + 통통 튀는 말랑 친구들 + 큰 웨이퍼 버튼 두 개.
// 버튼 안 진행 상황은 Boot가 읽어 둔 저장 데이터(saveRegistry)에서 가져온다.

import Phaser from 'phaser';
import { GAME, MENU, THEME } from '../config';
import type { Color } from '../core/types';
import { addButton, type PressLock } from '../view/ui/Button';
import { addSceneBackground } from '../view/theme/sceneBackground';
import { blockKey, ensureTextures } from '../view/theme/textures';
import { getActiveThemeId, getTheme, setActiveTheme, type ThemeId } from '../view/theme/themes';
import { openThemePicker } from '../view/ThemePicker';
import { setTheme } from '../storage/progress';
import { storyLabel, storyProgress, timeAttackLabel } from './menuText';
import { Music } from '../view/Music';
import { musicFor } from './musicRules';
import { addSceneMusicButton, addSceneMuteButton } from './muteToggle';
import { commitSave, getSave } from './saveRegistry';
import { startTimeAttack } from './startTimeAttack';
import { getStages } from './stageRegistry';

/** 테마 버튼 (MENU와 같은 방식, 2주차 config.ts는 장애물 태스크만 고쳐서 여기 둔다) */
const THEME_BUTTON = {
  text: '테마',
  dy: 345,
  button: { width: 340, height: 110, fontSize: 44, subFontSize: 26 },
} as const;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    const cx = GAME.width / 2;
    const cy = height / 2;

    addSceneBackground(this, width, height, { storybookArt: false, hills: true });

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
    addSceneMuteButton(this);
    addSceneMusicButton(this);
    const music = Music.of(this.game);
    music.play(musicFor('Menu'));
    music.load(this, ['timeattack', 'story']); // 게임 곡은 메뉴가 뜬 뒤 뒤에서

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
      () => startTimeAttack(this),
      lock,
    );
    this.addThemeButton(cx, cy + THEME_BUTTON.dy, lock);
    const r = MENU.ranking;
    addButton(
      this,
      cx,
      cy + r.dy,
      { width: r.width, height: r.height, fontSize: r.fontSize, label: r.text },
      () => this.scene.start('Ranking'),
      lock,
    );
  }

  /** 테마 버튼(스토리·경쟁과 같은 잠금): 지금 테마 이름을 작게 보여 주고, 누르면 고르기 창. 고르면 저장하고 메뉴를 다시 그린다 */
  private addThemeButton(cx: number, y: number, lock: PressLock): void {
    addButton(
      this,
      cx,
      y,
      { ...THEME_BUTTON.button, label: THEME_BUTTON.text, sub: getTheme(getActiveThemeId()).name },
      () =>
        openThemePicker(
          this,
          getActiveThemeId(),
          (id) => this.pickTheme(id),
          () => (lock.pressed = false), // 창이 닫혀야 메뉴 버튼이 다시 눌린다
        ),
      lock,
    );
  }

  private pickTheme(id: ThemeId): void {
    commitSave(this.registry, setTheme(getSave(this.registry), id));
    setActiveTheme(id);
    this.scene.restart();
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
