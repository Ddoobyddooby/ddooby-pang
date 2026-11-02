// 결과 화면 (W2-12, 스토리 W3-11: 스토리 화면 설계 4절). 모드를 모르고 ModeResult만 받는다.
// 무엇을 보일지(제목, 별, 줄, 버튼)는 resultView가 정하고, 이 씬은 그리기만 한다.
// 배치는 화면 가운데 기준 dy라 EXPAND로 세로가 길어져도 가운데에 온다.

import Phaser from 'phaser';
import { GAME, MUSIC, RESULT, THEME } from '../config';
import type { ModeResult } from '../modes/GameMode';
import { Music } from '../view/Music';
import { Sfx } from '../view/Sfx';
import { Background } from '../view/theme/Background';
import { addButton, type PressLock } from '../view/ui/Button';
import { drawCreamPanel } from '../view/ui/Panel';
import { musicFor } from './musicRules';
import {
  formatScore,
  resultLayout,
  resultSounds,
  resultView,
  type ResultButton,
  type ResultRow,
} from './resultText';
import { getSave } from './saveRegistry';
import type { GameData, ResultData } from './sceneData';
import { getStages } from './stageRegistry';

export class ResultScene extends Phaser.Scene {
  private result!: ModeResult;

  /** Android 뒤로 가기가 스토리면 지도, 경쟁이면 메뉴로 보낸다 (backButton.ts) */
  get resultKind(): ModeResult['kind'] {
    return this.result.kind;
  }
  private sfx!: Sfx;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.result = data.result;
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    const cx = GAME.width / 2;
    const cy = height / 2;
    const view = resultView(this.result, {
      stageCount: getStages(this.registry).story.length,
      unlocked: getSave(this.registry).story.unlocked,
    });

    // 게임 곡을 줄여 끝낸다. 결과 화면은 음악 없이 결과 소리만
    Music.of(this.game).play(musicFor('Result'), MUSIC.resultFadeMs);
    this.sfx = new Sfx(this);
    // 스토리는 성공/실패, 경쟁은 최고 기록 여부 (resultSounds)
    for (const name of resultSounds(this.result)) this.sfx.play(name);

    new Background(this);
    // 있는 줄만 고른 간격으로 쌓아 화면 가운데에 (resultLayout)
    const layout = resultLayout(view);
    const at = (row: ResultRow) => cy + (layout.rows[row] ?? 0);
    drawCreamPanel(
      this,
      cx,
      cy + layout.top - RESULT.panel.padTop,
      cy + layout.bottom + RESULT.panel.padBottom,
      RESULT.panel,
    );

    this.label(cx, at('title'), view.title, RESULT.title.fontSize, THEME.title.fill).setStroke(
      THEME.title.stroke,
      RESULT.title.strokeThickness,
    );
    if (view.stars !== null) this.addStars(cx, at('stars'), view.stars);
    this.label(
      cx,
      at('scoreLabel'),
      RESULT.text.scoreLabel,
      RESULT.scoreLabel.fontSize,
      THEME.info.text,
    );
    this.label(
      cx,
      at('score'),
      formatScore(this.result.score),
      RESULT.score.fontSize,
      THEME.title.fill,
    ).setStroke(THEME.title.stroke, RESULT.score.strokeThickness);

    const line = view.best ?? view.bonus;
    if (line) this.label(cx, at('line'), line, RESULT.line.fontSize, THEME.info.text);
    if (view.newBest) this.addBadge(cx, at('badge'));
    if (view.allClear) {
      this.label(
        cx,
        at('allClear'),
        RESULT.text.allClear,
        RESULT.allClear.fontSize,
        THEME.title.fill,
      );
    }

    const lock: PressLock = { pressed: false };
    const b = RESULT.button;
    view.buttons.forEach((id, i) => {
      addButton(
        this,
        cx,
        cy + (layout.buttons[i] ?? 0),
        { ...b, label: RESULT.buttons[id] },
        () => this.go(id),
        lock,
      );
    });
  }

  private go(button: ResultButton): void {
    const result = this.result;
    switch (button) {
      case 'retry':
        this.scene.start(
          'Game',
          (result.kind === 'story'
            ? { mode: 'story', stageId: result.stageId }
            : { mode: 'timeattack' }) satisfies GameData,
        );
        break;
      case 'next':
        if (result.kind === 'story') {
          this.scene.start('Game', {
            mode: 'story',
            stageId: result.stageId + 1,
          } satisfies GameData);
        }
        break;
      case 'map':
        this.scene.start('StageMap');
        break;
      case 'menu':
        this.scene.start('Menu');
        break;
    }
  }

  private label(x: number, y: number, text: string, size: number, color: string) {
    return this.add
      .text(x, y, text, { fontFamily: THEME.font, fontSize: `${size}px`, color })
      .setOrigin(0.5);
  }

  /** 별 3칸: 빈 칸을 먼저 놓고, 받은 만큼 하나씩 통통 차오른다 */
  private addStars(cx: number, y: number, count: number): void {
    const s = RESULT.stars;
    const star = (x: number, fill: number) =>
      this.add.star(x, y, 5, s.r * 0.45, s.r, fill).setStrokeStyle(4, THEME.wafer.stroke);
    for (let k = 0; k < 3; k++) {
      const x = cx + (k - 1) * s.gap;
      star(x, s.empty);
      if (k >= count) continue;
      const filled = star(x, THEME.star).setScale(0);
      this.tweens.chain({
        targets: filled,
        tweens: [
          {
            scale: s.popScale,
            duration: s.popMs * 0.6,
            delay: s.delay + k * s.interval,
            ease: 'Back.easeOut',
            onStart: () => this.sfx.play('star'), // delay가 끝나 차오르기 시작할 때
          },
          { scale: 1, duration: s.popMs * 0.4, ease: 'Quad.easeIn' },
        ],
      });
    }
  }

  /** "최고 기록!" 배지: 노란 알약이 통통 튄다 */
  private addBadge(x: number, y: number): void {
    const b = RESULT.badge;
    const text = this.label(0, 0, RESULT.text.newBest, b.fontSize, THEME.title.fill);
    const w = text.width + b.padX * 2;
    const pill = this.add
      .graphics()
      .fillStyle(THEME.star, 1)
      .fillRoundedRect(-w / 2, -b.height / 2, w, b.height, b.height / 2)
      .lineStyle(3, THEME.wafer.stroke, 1)
      .strokeRoundedRect(-w / 2, -b.height / 2, w, b.height, b.height / 2);
    const badge = this.add.container(x, y, [pill, text]);
    this.tweens.add({
      targets: badge,
      scale: b.bounceScale,
      duration: b.bounceMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
