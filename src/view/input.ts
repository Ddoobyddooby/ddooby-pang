// 스와이프·탭-탭 입력 → { a, b } (PLAN 6.2). core는 입력 방식을 모른다.

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

export interface TapResult {
  selected: Pos | null;
  swap?: [Pos, Pos];
}

/**
 * 탭-탭 선택 규칙: 처음 탭 → 선택, 같은 칸 → 해제, 인접 칸 → 스왑하고 해제,
 * 그 밖(멀리·대각선) → 선택 변경
 */
export function tapSelect(selected: Pos | null, tapped: Pos): TapResult {
  if (!selected) return { selected: tapped };
  const dist = Math.abs(selected.r - tapped.r) + Math.abs(selected.c - tapped.c);
  if (dist === 0) return { selected: null };
  if (dist === 1) return { selected: null, swap: [selected, tapped] };
  return { selected: tapped };
}

/**
 * 씬의 포인터 이벤트를 받는다.
 * 스와이프가 확정되면 onSwap을 한 번, 문턱 미만으로 움직이고 뗀 탭은 tapSelect 규칙으로 처리한다.
 * 선택이 바뀔 때마다 onSelect를 부른다 (선택이 있는 채 스와이프하면 선택은 해제)
 */
export class BoardInput {
  private start: { pos: Pos; x: number; y: number } | null = null;
  private selected: Pos | null = null;
  private active = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: Layout,
    private readonly onSwap: (a: Pos, b: Pos) => void,
    private readonly onSelect: (pos: Pos | null) => void,
  ) {
    scene.input.on('pointerdown', this.handleDown, this);
    scene.input.on('pointermove', this.handleMove, this);
    scene.input.on('pointerup', this.handleUp, this);
    scene.events.once('shutdown', () => this.destroy());
  }

  get enabled(): boolean {
    return this.active;
  }

  /** 막히는 순간 선택도 해제한다 */
  set enabled(value: boolean) {
    this.active = value;
    if (!value) {
      this.start = null;
      this.select(null);
    }
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handleDown, this);
    this.scene.input.off('pointermove', this.handleMove, this);
    this.scene.input.off('pointerup', this.handleUp, this);
  }

  private select(pos: Pos | null): void {
    if (this.selected === pos) return;
    this.selected = pos;
    this.onSelect(pos);
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;
    const pos = cellAt(this.layout, pointer.worldX, pointer.worldY);
    this.start = pos ? { pos, x: pointer.worldX, y: pointer.worldY } : null;
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    if (!this.start || !pointer.isDown) return;
    const target = swipeTarget(
      this.layout,
      this.start.pos,
      pointer.worldX - this.start.x,
      pointer.worldY - this.start.y,
    );
    if (!target) return;
    const a = this.start.pos;
    this.start = null; // 한 번 누를 때 스왑은 한 번만
    this.select(null); // 스와이프가 우선, 선택은 해제
    if (this.active) this.onSwap(a, target);
  }

  private handleUp(): void {
    const start = this.start;
    this.start = null;
    if (!start || !this.active) return; // 스와이프로 이미 처리됐거나 입력이 막힘
    const result = tapSelect(this.selected, start.pos);
    this.select(result.selected);
    if (result.swap) this.onSwap(...result.swap);
  }
}
