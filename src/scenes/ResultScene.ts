// 임시 결과 화면 (W2-12, 레이아웃 설계 4절): 점수, 최고 점수, [다시하기].
// 모드를 모르고 ModeResult만 받는다. 배치는 화면 크기(this.scale) 기준 가운데라 세로가 길어져도 맞는다.

import Phaser from 'phaser';
import { DECOR, RESULT, THEME } from '../config';
import type { ModeResult } from '../modes/GameMode';
import { Background } from '../view/theme/Background';
import { addButton } from '../view/ui/Button';
import { formatScore } from './resultText';

export class ResultScene extends Phaser.Scene {
  private result!: ModeResult;

  constructor() {
    super('Result');
  }

  init(data: { result: ModeResult }): void {
    this.result = data.result;
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const result = this.result;

    new Background(this);
    this.drawPanel(cx, cy);
    this.label(
      cx,
      cy + RESULT.title.dy,
      RESULT.title.text,
      RESULT.title.fontSize,
      THEME.title.fill,
    ).setStroke(THEME.title.stroke, RESULT.title.strokeThickness);
    this.label(
      cx,
      cy + RESULT.scoreLabel.dy,
      RESULT.scoreLabel.text,
      RESULT.scoreLabel.fontSize,
      THEME.info.text,
    );
    this.label(
      cx,
      cy + RESULT.score.dy,
      formatScore(result.score),
      RESULT.score.fontSize,
      THEME.title.fill,
    ).setStroke(THEME.title.stroke, RESULT.score.strokeThickness);

    // 스토리 결과(클리어 여부, 별, [다음])는 W3-11에서 같은 씬에 분기를 추가한다. 지금은 점수만 보인다
    if (result.kind === 'timeattack') {
      const best = Math.max(result.bestScore, result.score);
      this.label(
        cx,
        cy + RESULT.best.dy,
        `${RESULT.best.label} ${formatScore(best)}`,
        RESULT.best.fontSize,
        THEME.info.text,
      );
      if (result.newBest) this.addBadge(cx, cy + RESULT.badge.dy);
    }

    const b = RESULT.button;
    addButton(this, cx, cy + b.dy, { ...b, label: b.text }, () => this.scene.start('Game'));
  }

  private label(x: number, y: number, text: string, size: number, color: string) {
    return this.add
      .text(x, y, text, { fontFamily: THEME.font, fontSize: `${size}px`, color })
      .setOrigin(0.5);
  }

  /** 반투명 크림 판 + 웨이퍼 테두리 (BoardFrame과 같은 색·두께) */
  private drawPanel(cx: number, cy: number): void {
    const { width: w, height: h, alpha } = RESULT.panel;
    const { radius, border } = DECOR.frame;
    this.add
      .graphics()
      .fillStyle(THEME.wafer.inner, alpha)
      .fillRoundedRect(cx - w / 2, cy - h / 2, w, h, radius)
      .lineStyle(border, THEME.wafer.stroke, 1)
      .strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, radius);
  }

  /** "최고 기록!" 배지: 노란 알약이 통통 튄다 */
  private addBadge(x: number, y: number): void {
    const b = RESULT.badge;
    const text = this.label(0, 0, b.text, b.fontSize, THEME.title.fill);
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
