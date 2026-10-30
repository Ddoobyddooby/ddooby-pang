// 스토리 정보 패널 내용 (설계 5절): 왼쪽 미션 줄(최대 2) + 점수 줄, 오른쪽 남은 이동 배지.
// 값이 바뀔 때만 다시 그린다. 체크 표시는 Jua에 없는 글자 대신 코드로 그린다.

import Phaser from 'phaser';
import { HUD, THEME } from '../config';
import type { GoalProgressLike } from './storyLines';
import { isMovesLow, storyLines, type GoalLine } from './storyLines';
import type { ScreenLayout } from './layout';
import { blockKey } from './theme/textures';

interface Row {
  text: Phaser.GameObjects.Text;
  check: Phaser.GameObjects.Graphics;
  lastText: string;
  lastDone: boolean;
}

export class StoryPanel {
  private readonly rows: Row[] = [];
  private readonly scoreLine: Phaser.GameObjects.Text | null;
  private readonly count: Phaser.GameObjects.Text;
  private lastScoreText = '';
  private lastMoves = -1;
  private lastLow: boolean | null = null;

  /** goals: 스테이지의 미션 (줄 구성은 고정이라 처음 한 번만 만든다) */
  constructor(
    private readonly scene: Phaser.Scene,
    screen: ScreenLayout,
    goals: readonly GoalProgressLike[],
  ) {
    const s = HUD.story;
    const { panel } = screen;
    const left = panel.x + HUD.panel.padX;
    const leftW = panel.w - HUD.panel.padX * 2 - HUD.panel.rightReserve;
    const initial = storyLines(goals, 0, s.maxGoalLines);
    const lineCount = initial.goals.length + (initial.scoreText === null ? 0 : 1);
    const lineY = (i: number) => panel.y + s.centerY + (i - (lineCount - 1) / 2) * s.lineGap;

    initial.goals.forEach((line, i) => {
      const y = lineY(i);
      let x = left;
      if (line.color !== null) {
        scene.add
          .image(x + s.icon.size / 2, y, blockKey(line.color, 'normal'))
          .setDisplaySize(s.icon.size, s.icon.size);
        x += s.icon.size + s.icon.gap;
      }
      const text = scene.add
        .text(x, y, '', {
          fontFamily: THEME.font,
          fontSize: `${s.goalFontSize}px`,
          color: THEME.info.text,
        })
        .setOrigin(0, 0.5);
      const check = scene.add.graphics({ x: left + leftW - s.check.size, y }).setVisible(false);
      this.rows.push({ text, check, lastText: '', lastDone: false });
    });
    this.scoreLine =
      initial.scoreText === null
        ? null
        : scene.add
            .text(left, lineY(lineCount - 1), '', {
              fontFamily: THEME.font,
              fontSize: `${s.scoreFontSize}px`,
              color: THEME.info.score,
            })
            .setOrigin(0, 0.5);

    // 오른쪽 열: 남은 이동 배지 (동그란 크림 바탕 + 큰 숫자 + 아래 "이동")
    const cx = panel.x + panel.w - HUD.panel.padX - HUD.panel.rightReserve / 2;
    const cy = panel.y + panel.h / 2;
    scene.add
      .graphics()
      .fillStyle(0xffffff, 1)
      .fillCircle(cx, cy, s.badge.radius)
      .lineStyle(s.badge.border, THEME.wafer.stroke, 1)
      .strokeCircle(cx, cy, s.badge.radius);
    this.count = scene.add
      .text(cx, cy + s.badge.countDy, '', {
        fontFamily: THEME.font,
        fontSize: `${s.badge.countFontSize}px`,
        color: THEME.info.text,
      })
      .setOrigin(0.5);
    scene.add
      .text(cx, cy + s.badge.labelDy, '이동', {
        fontFamily: THEME.font,
        fontSize: `${s.badge.labelFontSize}px`,
        color: THEME.info.text,
      })
      .setOrigin(0.5);
  }

  /** 점수·미션 진행. 줄 글자·달성 여부가 바뀐 줄만 다시 쓴다 */
  setProgress(progress: readonly GoalProgressLike[], score: number): void {
    const { goals, scoreText } = storyLines(progress, score, HUD.story.maxGoalLines);
    goals.forEach((line, i) => this.updateRow(this.rows[i]!, line));
    if (this.scoreLine && scoreText !== null && scoreText !== this.lastScoreText) {
      this.lastScoreText = scoreText;
      this.scoreLine.setText(scoreText);
    }
  }

  private updateRow(row: Row, line: GoalLine): void {
    if (line.text !== row.lastText) {
      row.lastText = line.text;
      row.text.setText(line.text);
    }
    if (line.done === row.lastDone) return;
    row.lastDone = line.done;
    const { check } = HUD.story;
    row.check.setVisible(line.done).clear();
    if (!line.done) return;
    const r = check.size;
    row.check
      .lineStyle(check.width, check.color, 1)
      .beginPath()
      .moveTo(-r * 0.6, 0)
      .lineTo(-r * 0.15, r * 0.45)
      .lineTo(r * 0.65, -r * 0.5)
      .strokePath();
    this.scene.tweens.killTweensOf(row.check);
    row.check.setScale(1);
    this.scene.tweens.add({
      targets: row.check,
      scale: check.pulseScale,
      duration: check.pulseMs,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** 남은 이동. 5 이하면 빨강, 이동할 때마다 통통 */
  setMoves(movesLeft: number): void {
    const low = isMovesLow(movesLeft, HUD.story.movesWarn);
    if (movesLeft === this.lastMoves && low === this.lastLow) return;
    const changed = movesLeft !== this.lastMoves;
    const first = this.lastMoves < 0;
    this.lastMoves = movesLeft;
    this.lastLow = low;
    this.count.setText(String(movesLeft)).setColor(low ? THEME.info.warn : THEME.info.text);
    if (low && changed && !first) {
      this.scene.tweens.killTweensOf(this.count);
      this.count.setScale(1);
      this.scene.tweens.add({
        targets: this.count,
        scale: HUD.panel.pulse.scale,
        duration: HUD.panel.pulse.ms,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }
}
