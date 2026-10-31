// 결과 화면 (W2-12, 스토리 W3-11: 스토리 화면 설계 4절). 모드를 모르고 ModeResult만 받는다.
// 무엇을 보일지(제목, 별, 줄, 버튼)는 resultView가 정하고, 이 씬은 그리기만 한다.
// 배치는 화면 가운데 기준 dy라 EXPAND로 세로가 길어져도 가운데에 온다.

import Phaser from 'phaser';
import { DECOR, GAME, RESULT, THEME } from '../config';
import type { ModeResult } from '../modes/GameMode';
import { Sfx } from '../view/Sfx';
import { Background } from '../view/theme/Background';
import { addButton, type PressLock } from '../view/ui/Button';
import { formatScore, resultView, type ResultButton } from './resultText';
import { getSave } from './saveRegistry';
import type { GameData, ResultData } from './sceneData';
import { getStages } from './stageRegistry';

export class ResultScene extends Phaser.Scene {
  private result!: ModeResult;
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

    this.sfx = new Sfx(this);
    // 경쟁은 늘 클리어 소리, 스토리는 성공/실패
    this.sfx.play(this.result.kind === 'story' && !this.result.cleared ? 'fail' : 'clear');

    new Background(this);
    const b = RESULT.button;
    const lastButtonY = cy + b.dy + (view.buttons.length - 1) * b.step;
    this.drawPanel(
      cx,
      cy + RESULT.title.dy - RESULT.panel.padTop,
      lastButtonY + b.height / 2 + RESULT.panel.padBottom,
    );

    this.label(
      cx,
      cy + RESULT.title.dy,
      view.title,
      RESULT.title.fontSize,
      THEME.title.fill,
    ).setStroke(THEME.title.stroke, RESULT.title.strokeThickness);
    if (view.stars !== null) this.addStars(cx, cy + RESULT.stars.dy, view.stars);
    this.label(
      cx,
      cy + RESULT.scoreLabel.dy,
      RESULT.text.scoreLabel,
      RESULT.scoreLabel.fontSize,
      THEME.info.text,
    );
    this.label(
      cx,
      cy + RESULT.score.dy,
      formatScore(this.result.score),
      RESULT.score.fontSize,
      THEME.title.fill,
    ).setStroke(THEME.title.stroke, RESULT.score.strokeThickness);

    const line = view.best ?? view.bonus;
    if (line) this.label(cx, cy + RESULT.line.dy, line, RESULT.line.fontSize, THEME.info.text);
    if (view.newBest) this.addBadge(cx, cy + RESULT.badge.dy);
    if (view.allClear) {
      this.label(
        cx,
        cy + RESULT.allClear.dy,
        RESULT.text.allClear,
        RESULT.allClear.fontSize,
        THEME.title.fill,
      );
    }

    const lock: PressLock = { pressed: false };
    view.buttons.forEach((id, i) => {
      addButton(
        this,
        cx,
        cy + b.dy + i * b.step,
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

  /** 반투명 크림 판 + 웨이퍼 테두리 (BoardFrame과 같은 색·두께). 위·아래 끝은 내용에 맞춘다 */
  private drawPanel(cx: number, top: number, bottom: number): void {
    const { width: w, alpha } = RESULT.panel;
    const { radius, border } = DECOR.frame;
    this.add
      .graphics()
      .fillStyle(THEME.wafer.inner, alpha)
      .fillRoundedRect(cx - w / 2, top, w, bottom - top, radius)
      .lineStyle(border, THEME.wafer.stroke, 1)
      .strokeRoundedRect(cx - w / 2, top, w, bottom - top, radius);
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
