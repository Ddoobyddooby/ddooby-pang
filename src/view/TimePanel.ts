// 타임어택 정보 패널 내용: 점수(큰 숫자), 남은 시간 글자와 막대. 글자는 값이 바뀔 때만 setText 한다.

import Phaser from 'phaser';
import { HUD, THEME, TIMEATTACK } from '../config';
import type { ScreenLayout } from './layout';
import { formatScore, formatTime } from './format';

export class TimePanel {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly barX: number;
  private readonly barY: number;
  private readonly barW: number;
  private lastScore = -1;
  private lastSec = -1;
  private lastBarPx = -1;
  private lastWarn: boolean | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    screen: ScreenLayout,
  ) {
    const { panel } = screen;
    const p = HUD.panel;
    const left = panel.x + p.padX;
    const label = {
      fontFamily: THEME.font,
      fontSize: `${p.label.fontSize}px`,
      color: THEME.info.text,
    };
    scene.add.text(left, panel.y + p.label.y, '점수', label);
    this.scoreText = scene.add.text(left, panel.y + p.score.y, '0', {
      fontFamily: THEME.font,
      fontSize: `${p.score.fontSize}px`,
      color: THEME.info.score,
    });
    this.timeText = scene.add
      .text(left, panel.y + p.time.y, '', { ...label, fontSize: `${p.time.fontSize}px` })
      .setOrigin(0, 0.5);
    this.barX = left;
    this.barY = panel.y + p.bar.y;
    this.barW = panel.w - p.padX * 2 - p.rightReserve;
    this.bar = scene.add.graphics();
  }

  setScore(score: number): void {
    if (score === this.lastScore) return;
    this.lastScore = score;
    this.scoreText.setText(formatScore(score));
  }

  /** 남은 시간. 글자는 초가 바뀔 때만, 막대는 픽셀이 바뀔 때만 다시 그린다 */
  setTime(timeLeftMs: number, totalMs: number): void {
    const warn = timeLeftMs > 0 && timeLeftMs <= TIMEATTACK.warnMs;
    const sec = Math.ceil(timeLeftMs / 1000);
    if (sec !== this.lastSec || warn !== this.lastWarn) {
      const secChanged = sec !== this.lastSec;
      this.lastSec = sec;
      this.timeText.setText(`남은 시간 ${formatTime(timeLeftMs)}`);
      this.timeText.setColor(warn ? THEME.info.warn : THEME.info.text);
      if (warn && secChanged) this.pulse();
    }
    const { border, height } = HUD.panel.bar;
    const inner = this.barW - border * 2;
    const px = Math.round((Math.max(0, timeLeftMs) / totalMs) * inner);
    if (px === this.lastBarPx && warn === this.lastWarn) return;
    this.lastBarPx = px;
    this.lastWarn = warn;
    const bar = THEME.info.bar;
    const r = height / 2;
    this.bar
      .clear()
      .fillStyle(bar.bg, 1)
      .fillRoundedRect(this.barX, this.barY, this.barW, height, r)
      .lineStyle(border, THEME.wafer.stroke, 1)
      .strokeRoundedRect(this.barX, this.barY, this.barW, height, r);
    if (px > 0) {
      this.bar
        .fillStyle(warn ? bar.warn : bar.fill, 1)
        .fillRoundedRect(
          this.barX + border,
          this.barY + border,
          px,
          height - border * 2,
          (height - border * 2) / 2,
        );
    }
  }

  /** 마지막 10초: 1초마다 시간 글자가 살짝 통통 튄다 (scale만) */
  private pulse(): void {
    this.scene.tweens.killTweensOf(this.timeText);
    this.timeText.setScale(1);
    this.scene.tweens.add({
      targets: this.timeText,
      scale: HUD.panel.pulse.scale,
      duration: HUD.panel.pulse.ms,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }
}
