// 스토리 시작 미션 카드 (PLAN 6.10): 보드 가운데 크림 판에 스테이지 / 미션 줄 / 이동 수.
// 통통 나타남 → 머묾 → 작아지며 정보 패널 쪽으로 날아가 사라짐. skip()은 머묾을 건너뛴다.
// 트윈·타이머는 씬 것을 써서 scene.pause 중에는 같이 멈춘다. 입력 막기는 GameScene이 한다.

import Phaser from 'phaser';
import { MISSION_CARD, THEME, UI } from '../config';
import type { MissionCardLines } from './missionCardLines';
import { obstacleIconKey } from './theme/obstacleArt';
import { blockKey } from './theme/textures';
import { drawCreamPanel } from './ui/Panel';

type Phase = 'appear' | 'hold' | 'fly' | 'done';

export class MissionCard {
  private readonly container: Phaser.GameObjects.Container;
  private phase: Phase = 'appear';
  private holdTimer?: Phaser.Time.TimerEvent;

  /** at: 카드 가운데(보드 가운데), to: 날아갈 곳(정보 패널 가운데), onDone: 사라진 뒤 한 번 */
  constructor(
    private readonly scene: Phaser.Scene,
    lines: MissionCardLines,
    at: { x: number; y: number },
    private readonly to: { x: number; y: number },
    private readonly onDone: () => void,
  ) {
    const c = MISSION_CARD;
    const height = c.title.h + c.gap + lines.goals.length * c.goal.h + c.gap + c.moves.h;
    const top = -height / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      drawCreamPanel(scene, 0, top - c.panel.padTop, -top + c.panel.padBottom, c.panel),
    ];

    let y = top + c.title.h / 2;
    items.push(
      scene.add
        .text(0, y, lines.title, {
          fontFamily: THEME.font,
          fontSize: `${c.title.fontSize}px`,
          color: THEME.title.fill,
          stroke: THEME.title.stroke,
          strokeThickness: c.title.strokeThickness,
        })
        .setOrigin(0.5),
    );
    y += c.title.h / 2 + c.gap + c.goal.h / 2;

    for (const line of lines.goals) {
      const text = scene.add
        .text(0, y, line.text, {
          fontFamily: THEME.font,
          fontSize: `${c.goal.fontSize}px`,
          color: THEME.info.text,
        })
        .setOrigin(0, 0.5);
      // 블록 그림 + 글자 묶음을 가로 가운데에
      const icon = line.color === null && !line.obstacle ? 0 : c.goal.icon.size + c.goal.icon.gap;
      const left = -(icon + text.width) / 2;
      if (line.obstacle) {
        items.push(
          scene.add
            .image(left + c.goal.icon.size / 2, y, obstacleIconKey(line.obstacle))
            .setDisplaySize(c.goal.icon.size, c.goal.icon.size),
        );
      }
      if (line.color !== null) {
        items.push(
          scene.add
            .image(left + c.goal.icon.size / 2, y, blockKey(line.color, 'normal'))
            .setDisplaySize(c.goal.icon.size, c.goal.icon.size),
        );
      }
      text.setX(left + icon);
      items.push(text);
      y += c.goal.h;
    }

    y += c.gap - c.goal.h / 2 + c.moves.h / 2;
    items.push(
      scene.add
        .text(0, y, lines.movesText, {
          fontFamily: THEME.font,
          fontSize: `${c.moves.fontSize}px`,
          color: UI.button.subColor,
        })
        .setOrigin(0.5),
    );

    this.container = scene.add.container(at.x, at.y, items).setScale(c.startScale);
    scene.tweens.add({
      targets: this.container,
      scale: 1,
      duration: c.appearMs,
      ease: 'Back.easeOut',
      onComplete: () => this.hold(),
    });
  }

  /** 지금 무엇을 하는 중인지 (확인용) */
  get state(): Phase {
    return this.phase;
  }

  /** 누르면: 나타나는 중이거나 머무는 중이면 바로 날아간다 */
  skip(): void {
    if (this.phase === 'appear' || this.phase === 'hold') this.fly();
  }

  private hold(): void {
    if (this.phase !== 'appear') return;
    this.phase = 'hold';
    this.holdTimer = this.scene.time.delayedCall(MISSION_CARD.holdMs, () => this.fly());
  }

  private fly(): void {
    this.phase = 'fly';
    this.holdTimer?.remove();
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      x: this.to.x,
      y: this.to.y,
      scale: MISSION_CARD.endScale,
      alpha: MISSION_CARD.endAlpha,
      duration: MISSION_CARD.flyMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.phase = 'done';
        this.container.destroy();
        this.onDone();
      },
    });
  }
}
