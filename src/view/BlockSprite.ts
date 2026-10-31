// 블록 하나의 그림. 미리 구워 둔 텍스처(theme/textures.ts)를 이미지로 보여 준다.
// 표정은 텍스처를 바꿔 끼우는 것으로 처리한다. 특수 블록 표시는 임시 (W2-07에서 다듬는다).

import Phaser from 'phaser';
import { ANIM, HINT, VIEW } from '../config';
import type { Block } from '../core/types';
import { blockKey, specialKey, type Face } from './theme/textures';

export class BlockSprite extends Phaser.GameObjects.Container {
  readonly blockId: number;
  /** BoardView가 제거를 시작하면 true. 표정 변경 등에서 제외하는 표시 */
  removing = false;

  private readonly faceImage: Phaser.GameObjects.Image;
  private readonly blockColor: Block['color'];
  /** 선택 표시는 몸통 이미지만 키운다. 컨테이너 scale을 쓰는 squish·pop과 겹치지 않게 */
  private readonly baseScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, block: Block, cellSize: number) {
    super(scene, x, y);
    this.blockId = block.id;
    this.blockColor = block.special === 'color' ? null : block.color;
    const size = cellSize * VIEW.blockScale;

    this.faceImage = scene.add
      .image(0, 0, blockKey(this.blockColor, 'normal'))
      .setDisplaySize(size, size);
    this.baseScale = this.faceImage.scaleX;
    this.add(this.faceImage);
    if (block.special && block.special !== 'color') {
      this.add(scene.add.image(0, 0, specialKey(block.special)).setDisplaySize(size, size));
    }
    scene.add.existing(this);
  }

  setFace(face: Face): this {
    this.faceImage.setTexture(blockKey(this.blockColor, face));
    return this;
  }

  /** 선택됐을 때 살짝 커진다 (말랑하게). 위치는 그대로, 기다리지 않는다 */
  setSelected(on: boolean): void {
    if (this.removing) return;
    this.scene.tweens.killTweensOf(this.faceImage);
    this.scene.tweens.add({
      targets: this.faceImage,
      scale: this.baseScale * (on ? VIEW.select.scale : 1),
      duration: VIEW.select.ms,
      ease: on ? 'Back.easeOut' : 'Sine.easeOut',
    });
  }

  /**
   * 힌트: 몸통 이미지가 말랑하게 커졌다 작아지기를 반복한다 (위치는 그대로).
   * 끄면 반복 트윈을 멈추고 원래 크기로 돌린다. 선택 표시와 같은 이미지를 쓰지만 힌트는 입력이 오면 먼저 꺼진다
   */
  setHint(on: boolean): void {
    this.scene.tweens.killTweensOf(this.faceImage);
    this.faceImage.setScale(this.baseScale);
    if (!on || this.removing) return;
    this.scene.tweens.add({
      targets: this.faceImage,
      scale: this.baseScale * HINT.scale,
      duration: HINT.pulseMs,
      yoyo: true,
      repeat: -1,
      repeatDelay: HINT.restMs,
      ease: 'Sine.easeInOut',
    });
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf(this.faceImage);
    super.destroy(fromScene);
  }

  /** 착지 눌림. scale만 바꾸므로 위치는 그대로다. 기다리지 않는다 */
  squish(): void {
    if (this.removing) return;
    const part = ANIM.squish / 3;
    const step = (scaleX: number, scaleY: number, next?: () => void) =>
      this.scene.tweens.add({
        targets: this,
        scaleX,
        scaleY,
        duration: part,
        ease: 'Sine.easeInOut',
        onComplete: next,
      });
    step(1.2, 0.8, () => step(0.9, 1.1, () => step(1, 1)));
  }

  /** 잠깐 scale배까지 커졌다 돌아온다 (전체 길이 duration). 위치는 그대로, 기다리지 않는다 */
  pop(scale: number, duration: number): void {
    if (this.removing) return;
    this.scene.tweens.add({
      targets: this,
      scale,
      duration: duration / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }
}
