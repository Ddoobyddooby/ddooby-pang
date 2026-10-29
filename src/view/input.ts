// 스와이프 입력 → { a, b } (PLAN 6.2). core는 입력 방식을 모른다.
// 탭-탭 입력은 W2-13에서 추가한다.

import type Phaser from 'phaser';
import { VIEW } from '../config';
import type { Pos } from '../core/types';
import { cellAt, type Layout } from './layout';

/**
 * 누른 칸에서 (dx, dy)만큼 끌었을 때 스왑할 상대 칸. 아직 덜 끌었거나 보드 밖이면 null.
 * 가로·세로 중 더 많이 움직인 방향 하나만 본다 (대각선 없음).
 */
export function swipeTarget(
  layout: Layout,
  start: Pos,
  dx: number,
  dy: number,
  threshold = VIEW.swipeThreshold,
): Pos | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < layout.cell * threshold) return null;
  const target =
    Math.abs(dx) >= Math.abs(dy)
      ? { r: start.r, c: start.c + Math.sign(dx) }
      : { r: start.r + Math.sign(dy), c: start.c };
  const inside = target.r >= 0 && target.r < layout.rows && target.c >= 0 && target.c < layout.cols;
  return inside ? target : null;
}

/** 씬의 포인터 이벤트를 받아 스와이프가 확정되는 순간 onSwap을 한 번 부른다 */
export class SwipeInput {
  enabled = true;
  private start: { pos: Pos; x: number; y: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: Layout,
    private readonly onSwap: (a: Pos, b: Pos) => void,
  ) {
    scene.input.on('pointerdown', this.handleDown, this);
    scene.input.on('pointermove', this.handleMove, this);
    scene.input.on('pointerup', this.handleUp, this);
    scene.events.once('shutdown', () => this.destroy());
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handleDown, this);
    this.scene.input.off('pointermove', this.handleMove, this);
    this.scene.input.off('pointerup', this.handleUp, this);
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    const pos = cellAt(this.layout, pointer.x, pointer.y);
    this.start = pos ? { pos, x: pointer.x, y: pointer.y } : null;
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    if (!this.start || !pointer.isDown) return;
    const target = swipeTarget(
      this.layout,
      this.start.pos,
      pointer.x - this.start.x,
      pointer.y - this.start.y,
    );
    if (!target) return;
    const a = this.start.pos;
    this.start = null; // 한 번 누를 때 스왑은 한 번만
    if (this.enabled) this.onSwap(a, target);
  }

  private handleUp(): void {
    this.start = null;
  }
}
